type UiStyle = 'skeuomorphism' | 'liquid-glass';

const STORAGE_KEY = 'sound-station-ui-style';

export function initStyleThemeSwitcher(): void {
  const body = document.body;
  const overlay = document.getElementById('style-theme-modal-overlay') as HTMLElement | null;
  const openButton = document.getElementById('btn-open-style-modal') as HTMLButtonElement | null;
  const closeButton = document.getElementById('btn-style-theme-close') as HTMLButtonElement | null;

  if (!overlay || !openButton || !closeButton) return;

  const optionButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>('.style-theme-option[data-ui-style]'),
  );

  const isValidStyle = (value: string | null | undefined): value is UiStyle => {
    return value === 'skeuomorphism' || value === 'liquid-glass';
  };

  const syncOptionState = (activeStyle: UiStyle): void => {
    optionButtons.forEach((button) => {
      const selected = button.dataset['uiStyle'] === activeStyle;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
  };

  const applyStyle = (style: UiStyle): void => {
    body.setAttribute('data-ui-style', style);
    window.localStorage.setItem(STORAGE_KEY, style);
    syncOptionState(style);
  };

  const closeModal = (): void => {
    overlay.classList.add('hidden');
  };

  const openModal = (): void => {
    const currentStyle = body.getAttribute('data-ui-style');
    syncOptionState(isValidStyle(currentStyle) ? currentStyle : 'skeuomorphism');
    overlay.classList.remove('hidden');
  };

  const savedStyle = window.localStorage.getItem(STORAGE_KEY);
  applyStyle(isValidStyle(savedStyle) ? savedStyle : 'skeuomorphism');

  openButton.addEventListener('click', () => {
    openModal();
  });

  closeButton.addEventListener('click', () => {
    closeModal();
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  optionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedStyle = button.dataset['uiStyle'];
      if (!isValidStyle(selectedStyle)) return;
      applyStyle(selectedStyle);
      closeModal();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeModal();
    }
  });
}
