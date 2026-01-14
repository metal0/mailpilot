export { createTikaClient, type TikaClient, type ExtractionResult } from "./tika.js";
export {
  createAttachmentProcessor,
  formatAttachmentsForPrompt,
  buildMultimodalContent,
  hasImages,
  type AttachmentProcessor,
  type ExtractedAttachment,
  type MultimodalContent,
} from "./processor.js";
