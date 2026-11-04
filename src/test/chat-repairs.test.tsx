import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatImage } from "@/components/elvyn/ChatImage";
import { DeleteChatButton } from "@/components/elvyn/DeleteChatButton";
import { deleteConversation } from "@/lib/chat-actions";
import { downloadChatMedia, loadChatMedia } from "@/lib/chat-media";
import { dict } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ download: vi.fn(), remove: vi.fn(), select: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ download: mocks.download }) }, from: () => ({ delete: () => ({ eq: () => ({ select: mocks.select }) }) }) } }));
vi.mock("@/lib/app-store", () => ({ useApp: () => ({ t: dict.en, remove: mocks.remove }) }));
beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:private-image"), revokeObjectURL: vi.fn() }));
  mocks.download.mockResolvedValue({ data: new Blob(["image bytes"], { type: "image/png" }), error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Private image repairs", () => {
  it("reads the private file instead of reusing an expired signed URL", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await loadChatMedia("owner/chat/image.png", "https://expired.invalid/image");
    expect(mocks.download).toHaveBeenCalledWith("owner/chat/image.png"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("downloads through a blob URL without opening another tab", async () => {
    vi.useFakeTimers(); const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { expect(this.href).toBe("blob:private-image"); expect(this.download).toBe("picture.png"); expect(this.target).toBe(""); });
    await downloadChatMedia("picture.png", "owner/chat/image.png");
    expect(click).toHaveBeenCalledOnce(); await vi.runAllTimersAsync(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-image"); click.mockRestore();
  });
  it("opens the actual stored image in the in-site dialog", async () => {
    render(<ChatImage path="owner/chat/image.png" name="picture.png" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open image", exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Open image", exact: true }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("dialog").querySelector("img")?.src).toBe("blob:private-image");
  });
});
describe("Chat deletion", () => {
  it("requires a returned deleted row before reporting success", async () => {
    mocks.select.mockResolvedValueOnce({ data: [], error: null }); await expect(deleteConversation("chat-id")).rejects.toThrow("could not be deleted");
    mocks.select.mockResolvedValueOnce({ data: [{ id: "chat-id" }], error: null }); await expect(deleteConversation("chat-id")).resolves.toBeUndefined();
  });
  it("confirms first and never navigates after a failed deletion", async () => {
    mocks.remove.mockResolvedValue(false); const onDeleted = vi.fn(); render(<DeleteChatButton id="chat-id" onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete chat" })); expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true })); await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("chat-id")); expect(onDeleted).not.toHaveBeenCalled();
  });
});