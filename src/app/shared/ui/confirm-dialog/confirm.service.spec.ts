import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTestBasics } from '../../../../testing/providers';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [...provideTestBasics(), provideNoopAnimations()],
    }),
  );

  async function open(details?: string[]) {
    const answer = TestBed.inject(ConfirmService).ask({
      titleKey: 'timetable.publish.title',
      details,
      danger: true,
    });
    await vi.waitFor(() => expect(document.querySelector('app-confirm-dialog')).not.toBeNull());
    return answer;
  }

  it('resolves true on confirm and shows the summary', async () => {
    const answer = open(['3 sections', '120 periods']);
    await vi.waitFor(() =>
      expect(document.querySelector('[data-testid="confirm-ok"]')).not.toBeNull(),
    );
    // Zoneless: the dialog's DOM exists before its bindings render, so wait for content.
    await vi.waitFor(() =>
      expect(document.querySelector('[data-testid="confirm-details"]')?.textContent).toContain(
        '120 periods',
      ),
    );
    document.querySelector<HTMLButtonElement>('[data-testid="confirm-ok"]')!.click();
    await expect(answer).resolves.toBe(true);
  });

  it('resolves false on cancel', async () => {
    const answer = open();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-testid="confirm-cancel"]')).not.toBeNull(),
    );
    document.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel"]')!.click();
    await expect(answer).resolves.toBe(false);
  });
});
