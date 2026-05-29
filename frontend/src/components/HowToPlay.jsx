import Tutorial from './Tutorial';

export default function HowToPlay({ onClose }) {
  return <Tutorial onClose={onClose} defaultSection="overview" />;
}
