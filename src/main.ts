import './styles/base.css';
import './styles/components/glossy-button.css';
import './styles/layout/dashboard.css';
import './styles/features/cards.css';
import './styles/features/player-bar.css';
import './styles/features/cover-flow.css';
import { runAppController } from './mvc/controller/AppController.js';

runAppController().catch(err => {
  console.error('[Sound-Station] Bootstrap error:', err);
});
