import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <nav class="layout__nav" aria-label="Main navigation">
        <div class="layout__brand"><h1>Recipe Manager</h1></div>
        <ul class="layout__links" role="list">
          <li><a routerLink="/dashboard" routerLinkActive="active" class="nav-link">Dashboard</a></li>
          <li><a routerLink="/pantry" routerLinkActive="active" class="nav-link">Pantry</a></li>
          <li><a routerLink="/recipes" routerLinkActive="active" class="nav-link">Recipes</a></li>
          <li><a routerLink="/staples" routerLinkActive="active" class="nav-link">Staples</a></li>
          <li><a routerLink="/meal-plan" routerLinkActive="active" class="nav-link">Meal Plan</a></li>
          <li><a routerLink="/shopping-list" routerLinkActive="active" class="nav-link">Shopping List</a></li>
        </ul>
      </nav>
      <main class="layout__content"><router-outlet /></main>
    </div>
  `,
  styles: [`
    .layout { display: flex; min-height: 100vh; }
    .layout__nav { width: 240px; background-color: #1a237e; color: white; padding: 1.5rem 0; flex-shrink: 0; }
    .layout__brand { padding: 0 1.5rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .layout__brand h1 { font-size: 1.25rem; margin: 0; font-weight: 600; }
    .layout__links { list-style: none; padding: 1rem 0; margin: 0; }
    .layout__links li { margin: 0; }
    .nav-link { display: block; padding: 0.75rem 1.5rem; color: rgba(255,255,255,0.8); text-decoration: none; transition: background-color 0.2s; }
    .nav-link:hover { background-color: rgba(255,255,255,0.1); color: white; }
    .nav-link.active { background-color: rgba(255,255,255,0.15); color: white; font-weight: 500; }
    .layout__content { flex: 1; padding: 2rem; background-color: #fafafa; }
  `],
})
export class LayoutComponent {}
