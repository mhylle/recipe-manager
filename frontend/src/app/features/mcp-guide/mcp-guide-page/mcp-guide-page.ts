import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { TranslatePipe } from '../../../shared/i18n';

/**
 * How to point your own assistant at this kitchen.
 *
 * Deliberately contains no shared secret. Before personal MCP keys this page
 * could not have existed publicly: access was one bearer token that made every
 * write look like the owner's, so a guide would have had to say "ask Martin",
 * which is the manual step self-service was meant to remove. It now sends the
 * reader to their own profile to mint a key.
 */
@Component({
  selector: 'app-mcp-guide-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './mcp-guide-page.html',
  styleUrl: './mcp-guide-page.scss',
})
export class McpGuidePageComponent {
  readonly auth = inject(AuthService);

  /** The deployed endpoint. Shown so the reader can copy it verbatim. */
  readonly endpoint = 'https://mhylle.com/mcp/recipe-manager';

  /**
   * The Desktop config, with the reader's key left as a placeholder.
   *
   * `X-MCP-Token:<key>` rather than `Authorization: Bearer <key>` because the
   * bearer scheme needs a space, and on Windows this bridge launches through
   * npx.cmd, which cmd.exe re-parses — an argument containing a space can arrive
   * split in two and the header is dropped with no error at all.
   */
  readonly configSnippet = `{
  "mcpServers": {
    "recipe-manager": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mhylle.com/mcp/recipe-manager",
        "--header", "X-MCP-Token:YOUR_KEY_HERE"
      ]
    }
  }
}`;

  constructor() {
    this.auth.checkAuth();
  }
}
