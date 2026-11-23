import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/**
 * Route `title`s are translation keys. Renders "<page> · <app name>" in the active
 * language and re-renders when the language changes.
 */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private lastKey: string | undefined;

  constructor() {
    super();
    this.translate.onLangChange.subscribe(() => this.render());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastKey = this.buildTitle(snapshot);
    this.render();
  }

  private render(): void {
    const app = this.translate.instant('app.name') as string;
    const page = this.lastKey ? (this.translate.instant(this.lastKey) as string) : undefined;
    this.title.setTitle(page ? `${page} · ${app}` : app);
  }
}
