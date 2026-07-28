import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';
import { AppUpdateService } from './shared/services/app-update.service';
import { TranslatePipe } from './shared/i18n';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  readonly appUpdate = inject(AppUpdateService);

  ngOnInit(): void {
    // Resolved once at the shell rather than per page, so any component can read
    // the signal synchronously instead of each racing its own request.
    this.authService.checkAuth();
  }

  reloadForUpdate(): void {
    void this.appUpdate.applyUpdate();
  }
}
