import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <header class="header glass-nav">
        <a routerLink="/dashboard" class="header__brand">The Atelier Kitchen</a>
        <nav class="header__nav" aria-label="Main navigation">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">Discover</a>
          <a routerLink="/recipes" routerLinkActive="active" class="nav-link">My Library</a>
          <a routerLink="/pantry" routerLinkActive="active" class="nav-link">Pantry</a>
          <a routerLink="/meal-plan" routerLinkActive="active" class="nav-link">Plan</a>
        </nav>
        <div class="header__actions">
          <a routerLink="/staples" routerLinkActive="active" class="nav-icon" aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </a>
        </div>
      </header>

      <main class="main"><router-outlet /></main>

      <footer class="footer">
        <div class="footer__inner">
          <div class="footer__brand">The Atelier Kitchen</div>
          <nav class="footer__links" aria-label="Secondary navigation">
            <a routerLink="/shopping-list">Shopping List</a>
            <a routerLink="/staples">Essentials</a>
          </nav>
          <div class="footer__copy">&copy; 2024 The Atelier Kitchen. Crafted for slow living.</div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* --- Glass Nav Header --- */
    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      height: 3.5rem;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-bottom: 1px solid var(--outline-variant);
    }

    .header__brand {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 1rem;
      font-weight: 400;
      color: var(--on-surface);
      text-decoration: none;
      white-space: nowrap;
    }

    .header__brand:hover {
      color: var(--primary);
    }

    .header__nav {
      display: flex;
      gap: 0.25rem;
    }

    .nav-link {
      padding: 0.375rem 0.875rem;
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 400;
      color: var(--on-surface-variant);
      text-decoration: none;
      border-radius: var(--radius-full);
      transition: all 0.15s ease;
      letter-spacing: 0.01em;
    }

    .nav-link:hover {
      color: var(--on-surface);
      background: var(--surface-container-low);
    }

    .nav-link.active {
      color: var(--primary);
      font-weight: 600;
      background: rgba(62, 106, 0, 0.06);
    }

    .header__actions {
      display: flex;
      align-items: center;
    }

    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      color: var(--on-surface-variant);
      border-radius: var(--radius-full);
      transition: all 0.15s ease;
    }

    .nav-icon:hover {
      color: var(--on-surface);
      background: var(--surface-container-low);
    }

    .nav-icon.active {
      color: var(--primary);
    }

    /* --- Main Content --- */
    .main {
      flex: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 2rem var(--spacing-section);
    }

    /* --- Footer --- */
    .footer {
      margin-top: auto;
      background: var(--surface-container-low);
      padding: 3rem 2rem;
    }

    .footer__inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer__brand {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 0.875rem;
      color: var(--on-surface-variant);
    }

    .footer__links {
      display: flex;
      gap: 1.5rem;
    }

    .footer__links a {
      font-size: 0.8125rem;
      color: var(--on-surface-variant);
    }

    .footer__links a:hover {
      color: var(--primary);
    }

    .footer__copy {
      font-size: 0.75rem;
      color: var(--on-surface-variant);
      opacity: 0.7;
    }

    /* --- Responsive --- */
    @media (max-width: 768px) {
      .header {
        padding: 0 1rem;
      }

      .header__brand {
        font-size: 0.875rem;
      }

      .nav-link {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
      }

      .main {
        padding: 1.5rem 1rem;
      }

      .footer__inner {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }
    }
  `],
})
export class LayoutComponent {}
