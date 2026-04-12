/**
 * ModalComponent
 *
 * Reusable glossy confirm modal component for destructive actions.
 */
export class ModalComponent {
  private readonly overlay = document.getElementById('confirm-modal-overlay') as HTMLElement;
  private readonly title = document.getElementById('confirm-modal-title') as HTMLElement;
  private readonly message = document.getElementById('confirm-modal-message') as HTMLElement;
  private readonly cancelButton = document.getElementById('confirm-modal-cancel') as HTMLButtonElement;
  private readonly confirmButton = document.getElementById('confirm-modal-confirm') as HTMLButtonElement;

  async confirm(input: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> {
    this.title.textContent = input.title ?? 'Confirm';
    this.message.textContent = input.message;
    this.confirmButton.textContent = input.confirmText ?? 'Confirm';
    this.cancelButton.textContent = input.cancelText ?? 'Cancel';

    this.overlay.classList.remove('hidden');

    return await new Promise<boolean>((resolve) => {
      const close = (result: boolean): void => {
        this.overlay.classList.add('hidden');
        this.cancelButton.removeEventListener('click', onCancel);
        this.confirmButton.removeEventListener('click', onConfirm);
        this.overlay.removeEventListener('click', onOverlay);
        resolve(result);
      };

      const onCancel = (): void => close(false);
      const onConfirm = (): void => close(true);
      const onOverlay = (event: MouseEvent): void => {
        if (event.target === this.overlay) close(false);
      };

      this.cancelButton.addEventListener('click', onCancel);
      this.confirmButton.addEventListener('click', onConfirm);
      this.overlay.addEventListener('click', onOverlay);
    });
  }
}
