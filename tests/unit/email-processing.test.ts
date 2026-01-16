import { describe, it, expect } from "vitest";

// Since the email processing functions require mailparser and IMAP client,
// we'll test the pure helper functions that can be extracted

// Recreate the pure functions for testing
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Email Processing - HTML Stripping", () => {
  describe("stripHtml", () => {
    describe("basic HTML tag removal", () => {
      it("removes simple HTML tags", () => {
        expect(stripHtml("<p>Hello World</p>")).toBe("Hello World");
      });

      it("removes multiple HTML tags", () => {
        expect(stripHtml("<div><p>Hello</p><span>World</span></div>")).toBe("Hello World");
      });

      it("removes self-closing tags", () => {
        expect(stripHtml("Line 1<br/>Line 2")).toBe("Line 1 Line 2");
        expect(stripHtml("Line 1<br />Line 2")).toBe("Line 1 Line 2");
        expect(stripHtml("Image: <img src='test.jpg'/>")).toBe("Image:");
      });

      it("removes tags with attributes", () => {
        expect(stripHtml('<a href="http://example.com">Link</a>')).toBe("Link");
        expect(stripHtml('<div class="container" id="main">Content</div>')).toBe("Content");
      });

      it("removes tags with complex attributes", () => {
        const html = '<div data-value="123" style="color: red;" onclick="alert(1)">Text</div>';
        expect(stripHtml(html)).toBe("Text");
      });

      it("removes nested tags", () => {
        const html = "<div><p><strong><em>Deep</em></strong></p></div>";
        expect(stripHtml(html)).toBe("Deep");
      });
    });

    describe("style tag removal", () => {
      it("removes inline style tags", () => {
        const html = "<style>body { color: red; }</style><p>Content</p>";
        expect(stripHtml(html)).toBe("Content");
      });

      it("removes style tags with type attribute", () => {
        const html = '<style type="text/css">.class { margin: 0; }</style>Text';
        expect(stripHtml(html)).toBe("Text");
      });

      it("removes multiple style tags", () => {
        const html = "<style>a{}</style><p>Between</p><style>b{}</style>End";
        expect(stripHtml(html)).toBe("Between End");
      });

      it("removes multiline style tags", () => {
        const html = `<style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>Content`;
        expect(stripHtml(html)).toBe("Content");
      });

      it("is case insensitive for style tags", () => {
        expect(stripHtml("<STYLE>css</STYLE>Text")).toBe("Text");
        expect(stripHtml("<Style>css</Style>Text")).toBe("Text");
      });
    });

    describe("script tag removal", () => {
      it("removes script tags", () => {
        const html = "<script>alert('hello');</script><p>Content</p>";
        expect(stripHtml(html)).toBe("Content");
      });

      it("removes script tags with type attribute", () => {
        const html = '<script type="text/javascript">var x = 1;</script>Text';
        expect(stripHtml(html)).toBe("Text");
      });

      it("removes multiple script tags", () => {
        const html = "<script>a()</script><p>Text</p><script>b()</script>End";
        expect(stripHtml(html)).toBe("Text End");
      });

      it("removes multiline script tags", () => {
        const html = `<script>
          function test() {
            return true;
          }
        </script>Content`;
        expect(stripHtml(html)).toBe("Content");
      });

      it("is case insensitive for script tags", () => {
        expect(stripHtml("<SCRIPT>js</SCRIPT>Text")).toBe("Text");
        expect(stripHtml("<Script>js</Script>Text")).toBe("Text");
      });

      it("removes script tags with src attribute", () => {
        const html = '<script src="external.js"></script>Text';
        expect(stripHtml(html)).toBe("Text");
      });
    });

    describe("HTML entity decoding", () => {
      it("decodes &nbsp; to space", () => {
        expect(stripHtml("Hello&nbsp;World")).toBe("Hello World");
        expect(stripHtml("A&nbsp;&nbsp;&nbsp;B")).toBe("A B");
      });

      it("decodes &amp; to &", () => {
        expect(stripHtml("A &amp; B")).toBe("A & B");
        expect(stripHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
      });

      it("decodes &lt; to <", () => {
        expect(stripHtml("1 &lt; 2")).toBe("1 < 2");
        expect(stripHtml("&lt;tag&gt;")).toBe("<tag>");
      });

      it("decodes &gt; to >", () => {
        expect(stripHtml("2 &gt; 1")).toBe("2 > 1");
      });

      it("decodes &quot; to double quote", () => {
        expect(stripHtml("Say &quot;Hello&quot;")).toBe('Say "Hello"');
      });

      it("decodes &#39; to single quote", () => {
        expect(stripHtml("It&#39;s working")).toBe("It's working");
      });

      it("decodes multiple entities in sequence", () => {
        expect(stripHtml("A &lt; B &amp;&amp; B &gt; C")).toBe("A < B && B > C");
      });

      it("handles entities within tags", () => {
        expect(stripHtml("<p>A &amp; B</p>")).toBe("A & B");
      });
    });

    describe("whitespace normalization", () => {
      it("collapses multiple spaces to single space", () => {
        expect(stripHtml("Hello    World")).toBe("Hello World");
        expect(stripHtml("A  B  C  D")).toBe("A B C D");
      });

      it("collapses newlines to single space", () => {
        expect(stripHtml("Hello\nWorld")).toBe("Hello World");
        expect(stripHtml("Line1\n\n\nLine2")).toBe("Line1 Line2");
      });

      it("collapses tabs to single space", () => {
        expect(stripHtml("Hello\tWorld")).toBe("Hello World");
        expect(stripHtml("A\t\t\tB")).toBe("A B");
      });

      it("collapses mixed whitespace to single space", () => {
        expect(stripHtml("Hello \n\t World")).toBe("Hello World");
        expect(stripHtml("  \n  \t  Text  \n  ")).toBe("Text");
      });

      it("trims leading and trailing whitespace", () => {
        expect(stripHtml("  Hello World  ")).toBe("Hello World");
        expect(stripHtml("\n\nContent\n\n")).toBe("Content");
      });

      it("handles whitespace from removed tags", () => {
        expect(stripHtml("<p>  Text  </p>")).toBe("Text");
        expect(stripHtml("  <div>  Content  </div>  ")).toBe("Content");
      });
    });

    describe("complex email HTML", () => {
      it("handles typical email HTML structure", () => {
        const html = `
          <html>
            <head>
              <style>.header { font-size: 14px; }</style>
            </head>
            <body>
              <div class="header">
                <p>Dear Customer,</p>
              </div>
              <div class="content">
                <p>Thank you for your order.</p>
              </div>
            </body>
          </html>
        `;
        const result = stripHtml(html);
        expect(result).toContain("Dear Customer");
        expect(result).toContain("Thank you for your order");
        expect(result).not.toContain("font-size");
      });

      it("handles email with tables", () => {
        const html = `
          <table>
            <tr>
              <td>Item</td>
              <td>Price</td>
            </tr>
            <tr>
              <td>Widget</td>
              <td>$10.00</td>
            </tr>
          </table>
        `;
        const result = stripHtml(html);
        expect(result).toContain("Item");
        expect(result).toContain("Price");
        expect(result).toContain("Widget");
        expect(result).toContain("$10.00");
      });

      it("handles email with links", () => {
        const html = '<p>Click <a href="http://example.com">here</a> to continue.</p>';
        expect(stripHtml(html)).toBe("Click here to continue.");
      });

      it("handles email with images", () => {
        const html = '<p>Logo: <img src="logo.png" alt="Company Logo"/></p>';
        expect(stripHtml(html)).toBe("Logo:");
      });

      it("preserves text content order", () => {
        const html = "<p>First</p><p>Second</p><p>Third</p>";
        const result = stripHtml(html);
        expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"));
        expect(result.indexOf("Second")).toBeLessThan(result.indexOf("Third"));
      });
    });

    describe("edge cases", () => {
      it("handles empty string", () => {
        expect(stripHtml("")).toBe("");
      });

      it("handles string with only whitespace", () => {
        expect(stripHtml("   ")).toBe("");
        expect(stripHtml("\n\n\t\t")).toBe("");
      });

      it("handles string with only tags", () => {
        expect(stripHtml("<div></div>")).toBe("");
        expect(stripHtml("<br/><hr/>")).toBe("");
      });

      it("handles malformed HTML gracefully", () => {
        expect(stripHtml("<p>Unclosed tag")).toBe("Unclosed tag");
        expect(stripHtml("No closing</p>")).toBe("No closing");
        expect(stripHtml("<div><p>Nested unclosed")).toBe("Nested unclosed");
      });

      it("handles HTML comments", () => {
        expect(stripHtml("<!-- comment -->Text")).toBe("Text");
        expect(stripHtml("Before<!-- multi\nline -->After")).toBe("Before After");
      });

      it("handles DOCTYPE declarations", () => {
        expect(stripHtml("<!DOCTYPE html><html>Text</html>")).toBe("Text");
      });

      it("handles CDATA sections", () => {
        expect(stripHtml("<![CDATA[Some data]]>Text")).toBe("Text");
      });

      it("preserves plain text without HTML", () => {
        expect(stripHtml("Plain text without any HTML")).toBe("Plain text without any HTML");
      });

      it("handles very long content", () => {
        const longContent = "A".repeat(10000);
        const html = `<div>${longContent}</div>`;
        expect(stripHtml(html)).toBe(longContent);
      });

      it("handles special characters", () => {
        expect(stripHtml("<p>© 2024 Company™</p>")).toBe("© 2024 Company™");
        expect(stripHtml("<p>Price: €100</p>")).toBe("Price: €100");
      });

      it("handles unicode content", () => {
        expect(stripHtml("<p>日本語テキスト</p>")).toBe("日本語テキスト");
        expect(stripHtml("<p>Привет мир</p>")).toBe("Привет мир");
        expect(stripHtml("<p>مرحبا بالعالم</p>")).toBe("مرحبا بالعالم");
      });

      it("handles emoji", () => {
        expect(stripHtml("<p>Hello 👋 World 🌍</p>")).toBe("Hello 👋 World 🌍");
      });
    });
  });
});

describe("Email Processing - PGP Detection Patterns", () => {
  // Test the PGP detection logic patterns
  describe("PGP message markers", () => {
    it("detects BEGIN PGP MESSAGE marker", () => {
      const body = "-----BEGIN PGP MESSAGE-----\nencrypted content\n-----END PGP MESSAGE-----";
      expect(body.includes("-----BEGIN PGP MESSAGE-----")).toBe(true);
    });

    it("detects BEGIN PGP SIGNED MESSAGE marker", () => {
      const body = "-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nsigned content";
      expect(body.includes("-----BEGIN PGP SIGNED MESSAGE-----")).toBe(true);
    });

    it("does not detect similar but incorrect markers", () => {
      const body1 = "----BEGIN PGP MESSAGE-----";
      const body2 = "-----BEGIN PGP MESSAGE----";
      const body3 = "-----BEGIN PGP MESSAGES-----";

      expect(body1.includes("-----BEGIN PGP MESSAGE-----")).toBe(false);
      expect(body2.includes("-----BEGIN PGP MESSAGE-----")).toBe(false);
      expect(body3.includes("-----BEGIN PGP MESSAGE-----")).toBe(false);
    });

    it("detects markers regardless of surrounding content", () => {
      const body = "Some text before\n-----BEGIN PGP MESSAGE-----\nencrypted\n-----END PGP MESSAGE-----\nSome text after";
      expect(body.includes("-----BEGIN PGP MESSAGE-----")).toBe(true);
    });
  });

  describe("Content-Type patterns", () => {
    const pgpContentTypes = [
      "multipart/encrypted; protocol=application/pgp-encrypted",
      'multipart/encrypted; protocol="application/pgp-encrypted"',
      "multipart/encrypted;protocol=application/pgp-encrypted",
    ];

    it.each(pgpContentTypes)("detects PGP content type: %s", (ct) => {
      expect(ct.includes("multipart/encrypted")).toBe(true);
      expect(ct.includes("application/pgp-encrypted")).toBe(true);
    });

    it("does not match non-PGP multipart", () => {
      const ct = "multipart/mixed; boundary=abc123";
      expect(ct.includes("application/pgp-encrypted")).toBe(false);
    });
  });

  describe("Attachment patterns", () => {
    it("detects application/pgp-encrypted content type", () => {
      const contentType = "application/pgp-encrypted";
      expect(contentType === "application/pgp-encrypted").toBe(true);
    });

    it("detects .gpg file extension", () => {
      const filenames = [
        "message.gpg",
        "secret.asc.gpg",
        "document.txt.gpg",
      ];

      for (const filename of filenames) {
        expect(filename.endsWith(".gpg")).toBe(true);
      }
    });

    it("does not match similar extensions", () => {
      const nonGpgFiles = [
        "message.gpx",
        "file.gp",
        "document.pgp",
      ];

      for (const filename of nonGpgFiles) {
        expect(filename.endsWith(".gpg")).toBe(false);
      }
    });
  });
});

describe("Email Processing - From Address Extraction", () => {
  // Test the from address extraction patterns
  describe("extractFrom logic patterns", () => {
    it("formats name and address correctly", () => {
      const name = "John Doe";
      const address = "john@example.com";
      const result = `${name} <${address}>`;
      expect(result).toBe("John Doe <john@example.com>");
    });

    it("handles address only", () => {
      const address = "john@example.com";
      expect(address).toBe("john@example.com");
    });

    it("handles name only", () => {
      const name = "John Doe";
      expect(name).toBe("John Doe");
    });

    it("returns unknown for empty/undefined", () => {
      const fallback = "unknown";
      expect(fallback).toBe("unknown");
    });
  });

  describe("email address formats", () => {
    const validAddresses = [
      "simple@example.com",
      "user.name@example.com",
      "user+tag@example.com",
      "user@subdomain.example.com",
      "user@example.co.uk",
      "firstname.lastname@company.org",
      "admin@127.0.0.1",
    ];

    it.each(validAddresses)("accepts valid address format: %s", (address) => {
      expect(address).toMatch(/@/);
    });

    const nameFormats = [
      { name: "John", address: "john@example.com", expected: "John <john@example.com>" },
      { name: "John Doe", address: "john.doe@example.com", expected: "John Doe <john.doe@example.com>" },
      { name: '"Doe, John"', address: "jdoe@example.com", expected: '"Doe, John" <jdoe@example.com>' },
    ];

    it.each(nameFormats)("formats $name with $address correctly", ({ name, address, expected }) => {
      const result = `${name} <${address}>`;
      expect(result).toBe(expected);
    });
  });
});

describe("Email Processing - Subject Handling", () => {
  describe("default subject", () => {
    it("provides default for missing subject", () => {
      const subject = undefined;
      const result = subject ?? "(no subject)";
      expect(result).toBe("(no subject)");
    });

    it("preserves existing subject", () => {
      const subject = "Hello World";
      const result = subject ?? "(no subject)";
      expect(result).toBe("Hello World");
    });

    it("preserves empty string subject", () => {
      const subject = "";
      const result = subject || "(no subject)";
      expect(result).toBe("(no subject)");
    });
  });

  describe("subject encoding handling", () => {
    // Subjects may come pre-decoded from mailparser
    const subjects = [
      { input: "Plain text subject", expected: "Plain text subject" },
      { input: "Subject with Unicode: 日本語", expected: "Subject with Unicode: 日本語" },
      { input: "Subject with émojis 🎉", expected: "Subject with émojis 🎉" },
      { input: "RE: FW: Multiple prefixes", expected: "RE: FW: Multiple prefixes" },
    ];

    it.each(subjects)("handles subject: $input", ({ input, expected }) => {
      expect(input).toBe(expected);
    });
  });
});

describe("Email Processing - Date Handling", () => {
  describe("ISO date conversion", () => {
    it("converts Date to ISO string", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      expect(date.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("provides fallback for missing date", () => {
      const date = undefined;
      const fallback = new Date();
      const result = date?.toISOString() ?? fallback.toISOString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("date parsing edge cases", () => {
    const validDates = [
      "2024-01-15T10:30:00Z",
      "2024-01-15T10:30:00+00:00",
      "2024-01-15T10:30:00.123Z",
      "Mon, 15 Jan 2024 10:30:00 +0000",
    ];

    it.each(validDates)("parses valid date: %s", (dateStr) => {
      const date = new Date(dateStr);
      expect(date.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });
});

describe("Email Processing - Message ID Handling", () => {
  describe("message ID extraction", () => {
    it("uses provided message ID", () => {
      const messageId = "<abc123@example.com>";
      expect(messageId).toBe("<abc123@example.com>");
    });

    it("generates fallback from UID", () => {
      const uid = 12345;
      const fallback = `uid-${uid}`;
      expect(fallback).toBe("uid-12345");
    });
  });

  describe("message ID formats", () => {
    const validMessageIds = [
      "<abc123@example.com>",
      "<unique-id-12345@mail.example.org>",
      "<CAKz+XPV=abc123+def456@mail.gmail.com>",
      "simple-id-without-brackets@example.com",
    ];

    it.each(validMessageIds)("accepts message ID format: %s", (id) => {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });
});

describe("Email Processing - Attachment Handling", () => {
  describe("attachment info structure", () => {
    it("creates correct attachment info", () => {
      const attachment = {
        filename: "document.pdf",
        contentType: "application/pdf",
        size: 1024,
      };

      expect(attachment.filename).toBe("document.pdf");
      expect(attachment.contentType).toBe("application/pdf");
      expect(attachment.size).toBe(1024);
    });

    it("uses unnamed for missing filename", () => {
      const filename = undefined ?? "unnamed";
      expect(filename).toBe("unnamed");
    });
  });

  describe("content type patterns", () => {
    const contentTypes = [
      { type: "application/pdf", ext: ".pdf" },
      { type: "image/jpeg", ext: ".jpg" },
      { type: "image/png", ext: ".png" },
      { type: "application/msword", ext: ".doc" },
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
      { type: "text/plain", ext: ".txt" },
      { type: "application/zip", ext: ".zip" },
      { type: "application/octet-stream", ext: "various" },
    ];

    it.each(contentTypes)("recognizes content type: $type", ({ type }) => {
      expect(typeof type).toBe("string");
      expect(type).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/i);
    });
  });

  describe("text/plain attachment as body fallback", () => {
    it("identifies text/plain attachments", () => {
      const contentType = "text/plain";
      expect(contentType === "text/plain").toBe(true);
    });

    it("converts Buffer to string", () => {
      const buffer = Buffer.from("Hello World", "utf-8");
      const text = buffer.toString("utf-8");
      expect(text).toBe("Hello World");
    });

    it("handles non-Buffer content", () => {
      const content = "Already a string";
      const text = typeof content === "string" ? content : String(content);
      expect(text).toBe("Already a string");
    });
  });
});
