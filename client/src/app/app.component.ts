import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <app-navbar *ngIf="authService.currentUser"></app-navbar>
      <main class="flex-grow">
        <router-outlet></router-outlet>
      </main>
      <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-400">
        &copy; 2026 Global Exchange Corporate IT Help Desk. Confidential Financial Infrastructure.
      </footer>
    </div>
  `
})
export class AppComponent implements OnInit {
  public authService = inject(AuthService);

  ngOnInit() {
    this.authService.checkAuth().subscribe();
  }
}
