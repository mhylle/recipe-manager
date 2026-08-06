import { Routes } from '@angular/router';

export const MCP_GUIDE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./mcp-guide-page/mcp-guide-page').then((m) => m.McpGuidePageComponent),
  },
];
