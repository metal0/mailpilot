'use client';

import { useState } from 'react';

interface MatrixChatWidgetProps {
  roomId?: string;
  roomAlias?: string;
  theme?: 'light' | 'dark' | 'auto';
  height?: string;
}

export function MatrixChatWidget({
  roomId = '#mailpilot:i0.tf',
  roomAlias = 'Mailpilot Community',
  theme = 'auto',
  height = '500px',
}: MatrixChatWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const matrixUrl = `https://matrix.to/${roomId}`;
  const elementUrl = `https://app.element.io/#/room/${encodeURIComponent(roomId)}`;

  return (
    <div className="not-prose my-6 border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M.632.55v22.9H2.28V24H0V0h2.28v.55zm7.043 7.26v1.157h.033c.309-.443.683-.784 1.117-1.024.433-.245.936-.365 1.5-.365.54 0 1.006.107 1.4.318.394.212.728.499.999.862.27.363.477.78.617 1.252.14.471.21.956.21 1.456v5.483h-2.04V11.85c0-.286-.023-.57-.068-.85a2.064 2.064 0 0 0-.26-.733 1.472 1.472 0 0 0-.531-.506c-.225-.13-.504-.195-.836-.195-.316 0-.596.06-.84.182-.244.122-.45.295-.618.517a2.459 2.459 0 0 0-.4.753 3.3 3.3 0 0 0-.137.936v5.33H5.082V7.81zm11.591 0h1.81l.033 1.02h.034c.296-.362.66-.673 1.092-.932.432-.259.95-.389 1.558-.389.582 0 1.086.116 1.512.347.425.23.778.546 1.058.944.28.399.487.863.621 1.393.135.53.202 1.096.202 1.699 0 .621-.073 1.223-.22 1.807a4.816 4.816 0 0 1-.678 1.564c-.308.458-.695.833-1.162 1.126-.467.293-1.028.44-1.683.44-.542 0-1.004-.107-1.386-.318a2.31 2.31 0 0 1-.936-.888h-.034v4.687h-2.04V7.81zm3.572 6.218c.4 0 .733-.093.999-.279a1.96 1.96 0 0 0 .618-.727c.153-.302.26-.644.319-1.024.06-.38.09-.766.09-1.157 0-.33-.023-.66-.068-.989a3.565 3.565 0 0 0-.26-.944 1.996 1.996 0 0 0-.531-.712c-.225-.182-.514-.273-.867-.273-.35 0-.646.082-.887.246-.24.164-.437.38-.589.65a2.71 2.71 0 0 0-.308.888 5.724 5.724 0 0 0-.09.999c0 .337.03.68.09 1.027.06.347.168.66.324.938.155.278.363.51.621.695.258.185.583.278.975.278zM21.72 24h2.28v-.55H24V0h-2.28v.55h-.64V24z"/>
              </svg>
            </div>
            <div>
              <div className="font-semibold">{roomAlias}</div>
              <div className="text-xs text-muted-foreground">
                Join the community discussion
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 text-sm border rounded hover:bg-accent transition-colors"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded ? (
        <div className="p-4 space-y-4">
          {/* Embedded chat - placeholder */}
          <div
            className="bg-muted rounded-lg border flex items-center justify-center text-center p-8"
            style={{ height }}
          >
            <div className="max-w-md">
              <div className="text-4xl mb-4">💬</div>
              <h4 className="font-semibold mb-2">Matrix Chat</h4>
              <p className="text-sm text-muted-foreground mb-4">
                To join the Mailpilot community chat, open Matrix in your preferred client.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={elementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 inline-block"
                >
                  Open in Element →
                </a>
                <a
                  href={matrixUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border rounded text-sm hover:bg-accent inline-block"
                >
                  Choose Matrix Client →
                </a>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 text-sm">ℹ️</span>
              <div className="flex-1 text-xs text-blue-800 dark:text-blue-300">
                <p>
                  <strong>New to Matrix?</strong> Matrix is a decentralized, open-source chat protocol.
                  You can join using any Matrix client like Element, FluffyChat, or Nheko.
                </p>
                <p className="mt-2">
                  Room: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{roomId}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Get help, share feedback, and discuss features with the community
          </p>
          <a
            href={elementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Join Chat Room
          </a>
        </div>
      )}
    </div>
  );
}

// Simpler inline version for quick links
export function MatrixChatLink({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <a
      href="https://matrix.to/#/#mailpilot:i0.tf"
      target="_blank"
      rel="noopener noreferrer"
      className={className || "inline-flex items-center gap-1 text-primary hover:underline"}
    >
      {children || (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M.632.55v22.9H2.28V24H0V0h2.28v.55zm7.043 7.26v1.157h.033c.309-.443.683-.784 1.117-1.024.433-.245.936-.365 1.5-.365.54 0 1.006.107 1.4.318.394.212.728.499.999.862.27.363.477.78.617 1.252.14.471.21.956.21 1.456v5.483h-2.04V11.85c0-.286-.023-.57-.068-.85a2.064 2.064 0 0 0-.26-.733 1.472 1.472 0 0 0-.531-.506c-.225-.13-.504-.195-.836-.195-.316 0-.596.06-.84.182-.244.122-.45.295-.618.517a2.459 2.459 0 0 0-.4.753 3.3 3.3 0 0 0-.137.936v5.33H5.082V7.81zm11.591 0h1.81l.033 1.02h.034c.296-.362.66-.673 1.092-.932.432-.259.95-.389 1.558-.389.582 0 1.086.116 1.512.347.425.23.778.546 1.058.944.28.399.487.863.621 1.393.135.53.202 1.096.202 1.699 0 .621-.073 1.223-.22 1.807a4.816 4.816 0 0 1-.678 1.564c-.308.458-.695.833-1.162 1.126-.467.293-1.028.44-1.683.44-.542 0-1.004-.107-1.386-.318a2.31 2.31 0 0 1-.936-.888h-.034v4.687h-2.04V7.81zm3.572 6.218c.4 0 .733-.093.999-.279a1.96 1.96 0 0 0 .618-.727c.153-.302.26-.644.319-1.024.06-.38.09-.766.09-1.157 0-.33-.023-.66-.068-.989a3.565 3.565 0 0 0-.26-.944 1.996 1.996 0 0 0-.531-.712c-.225-.182-.514-.273-.867-.273-.35 0-.646.082-.887.246-.24.164-.437.38-.589.65a2.71 2.71 0 0 0-.308.888 5.724 5.724 0 0 0-.09.999c0 .337.03.68.09 1.027.06.347.168.66.324.938.155.278.363.51.621.695.258.185.583.278.975.278zM21.72 24h2.28v-.55H24V0h-2.28v.55h-.64V24z"/>
          </svg>
          Matrix Chat
        </>
      )}
    </a>
  );
}
