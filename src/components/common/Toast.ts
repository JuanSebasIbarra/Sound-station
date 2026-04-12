export type ToastKind = 'info' | 'success' | 'error';

export class Toast {
  constructor(private readonly container: HTMLElement) {}

  show(message: string, kind: ToastKind = 'info'): void {
    const item = document.createElement('div');
    item.className = `toast toast--${kind}`;
    item.textContent = message;
    this.container.appendChild(item);
    setTimeout(() => item.remove(), 3000);
  }
}
