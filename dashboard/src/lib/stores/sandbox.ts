import { writable } from "svelte/store";
import type { ActionType } from "../api";

export interface SandboxState {
  prompt: string;
  emailFrom: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  useRawEmail: boolean;
  rawEmail: string;
  folderMode: "predefined" | "auto_create";
  allowedFolders: string;
  existingFolders: string;
  selectedProvider: string;
  selectedModel: string;
  allowedActions: ActionType[];
  uploadedAttachment: { filename: string; text: string; truncated: boolean; size: number } | null;
}

const defaultState: SandboxState = {
  prompt: "",
  emailFrom: "sender@example.com",
  emailTo: "recipient@example.com",
  emailSubject: "Test Email Subject",
  emailBody: "This is a test email body.\n\nYou can edit this to test different classification scenarios.",
  useRawEmail: false,
  rawEmail: `From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 15 Jan 2024 10:30:00 +0000
Content-Type: text/plain; charset="UTF-8"

This is the email body content.
You can paste a real RFC822 email here.`,
  folderMode: "predefined",
  allowedFolders: "INBOX, Work, Personal, Finance, Archive",
  existingFolders: "INBOX, Sent, Drafts, Trash",
  selectedProvider: "",
  selectedModel: "",
  allowedActions: ["move", "spam", "flag", "read"],
  uploadedAttachment: null,
};

function createSandboxStore() {
  const { subscribe, set, update } = writable<SandboxState>(defaultState);

  return {
    subscribe,
    set,
    update,
    reset: () => set(defaultState),
  };
}

export const sandboxState = createSandboxStore();
