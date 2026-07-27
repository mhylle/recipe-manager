import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageSwitcherComponent } from '../shared/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../shared/i18n';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class LayoutComponent {}
