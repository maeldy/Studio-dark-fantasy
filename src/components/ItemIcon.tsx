import React from 'react';
import { ItemIconKey } from '../game/types';

interface ItemIconProps {
  icon: ItemIconKey;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ icon, className = 'h-6 w-6' }) => {
  switch (icon) {
    case 'branch':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19L19 5" stroke="#8a6845" />
          <path d="M10 13L7 7" stroke="#8a6845" />
          <path d="M14 9L19 10" stroke="#785838" />
        </svg>
      );
    case 'deadwood':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <rect x="4" y="9" width="16" height="6" rx="1.5" fill="#6b563f" stroke="#9d8364" strokeWidth="1.5" />
          <path d="M8 9v6M15 9v6" stroke="#473726" strokeWidth="1.4" />
        </svg>
      );
    case 'log':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 8h11a3 3 0 0 1 0 8H5a3 3 0 0 1 0-8Z" fill="#5e432b" stroke="#9a754e" strokeWidth="1.5" />
          <ellipse cx="16.5" cy="12" rx="2.2" ry="3.8" fill="#b59469" stroke="#7d5d3b" strokeWidth="1.2" />
        </svg>
      );
    case 'fiber':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 20c1-6 2-11 4-16" stroke="#7ca05b" />
          <path d="M12 20c0-6 1-11 2-15" stroke="#98ba73" />
          <path d="M16 20c-1-5-1-10 2-14" stroke="#68884c" />
        </svg>
      );
    case 'liana':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 5c4 3 1 8 6 10s3 4 7 4" stroke="#5b8749" />
          <path d="M9 9l3-1M13 15l3-1" stroke="#7ea863" />
        </svg>
      );
    case 'root':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="1.9" strokeLinecap="round">
          <path d="M12 4v6l-5 8M12 10l4 9M12 12l-1 8" stroke="#8b6944" />
          <path d="M9 14l-3 1M15 15l3 1" stroke="#694d30" />
        </svg>
      );
    case 'bark':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M6 5l12 1-1 13-11-1 1-13Z" fill="#5b412e" stroke="#9c7857" strokeWidth="1.4" />
          <path d="M10 8v7M14 9v8" stroke="#3b291c" strokeWidth="1.5" />
        </svg>
      );
    case 'resin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 4c3.5 4.5 5 7.2 5 10a5 5 0 1 1-10 0c0-2.8 1.5-5.5 5-10Z" fill="#d48d36" stroke="#f0bb6c" strokeWidth="1.4" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 15l3-7 7-2 4 5-2 7H7l-2-3Z" fill="#6f7880" stroke="#a6b0b8" strokeWidth="1.5" />
        </svg>
      );
    case 'flint':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 3l6 7-3 10-7-2-3-7 7-8Z" fill="#323b42" stroke="#8595a3" strokeWidth="1.5" />
        </svg>
      );
    case 'coal':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M6 11l4-5 7 2 2 6-5 5-7-2-1-6Z" fill="#1e2228" stroke="#5c6673" strokeWidth="1.5" />
        </svg>
      );
    case 'ore_iron':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 14l4-7 7-1 3 6-3 6H7l-2-4Z" fill="#686f76" stroke="#9aa3ab" strokeWidth="1.4" />
          <path d="M9 11l3-1 2 3-3 2-2-4Z" fill="#b35f3f" />
        </svg>
      );
    case 'ore_copper':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 14l4-7 7-1 3 6-3 6H7l-2-4Z" fill="#5e686b" stroke="#92a0a4" strokeWidth="1.4" />
          <path d="M9 10l4 1-1 4-4-1 1-4Z" fill="#56a682" />
        </svg>
      );
    case 'ore_tin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 14l4-7 7-1 3 6-3 6H7l-2-4Z" fill="#646d75" stroke="#a6b2bc" strokeWidth="1.4" />
          <circle cx="11" cy="12" r="2.2" fill="#d5e0e8" />
          <circle cx="14.5" cy="13.5" r="1.4" fill="#c2ced6" />
        </svg>
      );
    case 'mineral_amber':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 3l6 6-2 10-8 1-3-8 7-9Z" fill="#cf862c" stroke="#f2be72" strokeWidth="1.5" />
        </svg>
      );
    case 'mineral_moon':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 3l5 7-2 10H9L7 10l5-7Z" fill="#8bb9d4" stroke="#d9f0ff" strokeWidth="1.5" />
        </svg>
      );
    case 'mushroom':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 12c0-4 3.1-7 7-7s7 3 7 7H5Z" fill="#c79554" stroke="#ebd1a0" strokeWidth="1.4" />
          <rect x="10" y="12" width="4" height="7" rx="1" fill="#ded5c3" />
        </svg>
      );
    case 'glowcap':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 12c0-4 3.1-7 7-7s7 3 7 7H5Z" fill="#5ec4a8" stroke="#b6f7e3" strokeWidth="1.4" />
          <rect x="10" y="12" width="4" height="7" rx="1" fill="#b7d6cc" />
        </svg>
      );
    case 'berries':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="9" cy="14" r="3" fill="#9c303a" stroke="#d4636d" strokeWidth="1.2" />
          <circle cx="15" cy="14" r="3" fill="#8c2630" stroke="#c95661" strokeWidth="1.2" />
          <circle cx="12" cy="9.5" r="3" fill="#ad3842" stroke="#e0747d" strokeWidth="1.2" />
          <path d="M12 6l2-2" stroke="#648a4f" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'herb':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 20V6" stroke="#6b9358" />
          <path d="M12 14c-4 0-6-3-6-5 3 0 5 1 6 5ZM12 11c4 0 6-3 6-5-3 0-5 1-6 5Z" fill="#779f62" stroke="#9ec488" />
        </svg>
      );
    case 'flower':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 20v-7" stroke="#5f864d" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 5c2.2 2.2 3.5 4.2 3.5 6.5h-7C8.5 9.2 9.8 7.2 12 5Z" fill="#728db8" stroke="#b2c8eb" strokeWidth="1.3" />
        </svg>
      );
    case 'medicinal':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 20V8" stroke="#689158" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7" r="2" fill="#e5dec8" />
          <circle cx="8.5" cy="9" r="1.8" fill="#d9d1b8" />
          <circle cx="15.5" cy="9" r="1.8" fill="#d9d1b8" />
        </svg>
      );
    case 'seeds':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <ellipse cx="9" cy="11" rx="2.2" ry="3.2" fill="#9c8055" stroke="#cbb082" strokeWidth="1.2" />
          <ellipse cx="15" cy="10" rx="2" ry="3" fill="#876c45" stroke="#baa073" strokeWidth="1.2" />
          <ellipse cx="12.5" cy="15.5" rx="2.2" ry="3" fill="#a88b5f" stroke="#d4ba8c" strokeWidth="1.2" />
        </svg>
      );
    case 'edible_root':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M8 9c0-2 2-3.5 4-3.5s4 1.5 4 3.5c0 4-2.5 8-4 10.5C10.5 17 8 13 8 9Z" fill="#9e774c" stroke="#cfa576" strokeWidth="1.4" />
          <path d="M12 5.5L10 3M12 5.5L14 3" stroke="#688f54" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'feather':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round">
          <path d="M5 19L18 5" stroke="#a6b2bd" strokeWidth="1.6" />
          <path d="M8 16c-1-4 2-9 10-11-1 7-6 11-10 11Z" fill="#3a434d" stroke="#7f8c99" strokeWidth="1.3" />
        </svg>
      );
    case 'bone':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M7 15l8-8a2 2 0 1 1 2.8 2.8l-8 8A2 2 0 1 1 7 15Z" fill="#d9d1bc" stroke="#a89f8b" strokeWidth="1.2" />
        </svg>
      );
    case 'hide':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M6 6l4 2h4l4-2-1 6 2 6-5-1h-4l-5 1 2-6-1-6Z" fill="#7c5638" stroke="#b3845d" strokeWidth="1.4" />
        </svg>
      );
    case 'fur':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 15l3-8 4 2 4-2 3 8-7 4-7-4Z" fill="#6b7178" stroke="#a9b0b8" strokeWidth="1.4" />
        </svg>
      );
    case 'fang':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M8 5l8 2c-1 6-4 10-7 13 0-5-.5-10-1-15Z" fill="#e2dac6" stroke="#9c937e" strokeWidth="1.4" />
        </svg>
      );
    case 'coin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="12" cy="12" r="7" fill="#c79b44" stroke="#f0cd7d" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" stroke="#8a6725" strokeWidth="1.2" />
        </svg>
      );
    case 'pottery':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M9 5h6l-1 3 3 4v6H7v-6l3-4-1-3Z" fill="#946249" stroke="#c79073" strokeWidth="1.4" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <rect x="6" y="4" width="12" height="16" rx="1.5" fill="#633e28" stroke="#c29263" strokeWidth="1.5" />
          <path d="M9 4v16" stroke="#3c2315" strokeWidth="1.5" />
          <path d="M11.5 9h4M11.5 12h4" stroke="#d9c39e" strokeWidth="1.2" />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="12" cy="12" r="7.5" fill="#3a3327" stroke="#d1a256" strokeWidth="1.6" />
          <path d="M14.5 9.5l-1.8 4.2-3.2 1.8 1.8-4.2 3.2-1.8Z" fill="#e0a65c" />
        </svg>
      );
    case 'seal':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="12" cy="12" r="6.5" fill="#3e4b56" stroke="#b0c4d4" strokeWidth="1.6" />
          <path d="M12 8.5v7M8.5 12h7" stroke="#d5e2eb" strokeWidth="1.4" />
        </svg>
      );
    case 'axe':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19L16 8" stroke="#8a6845" strokeWidth="2.2" />
          <path d="M13 5l6 2-2 6-5-3 1-5Z" fill="#7c8791" stroke="#c3ced6" strokeWidth="1.4" />
        </svg>
      );
    case 'pickaxe':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19L16 8" stroke="#8a6845" strokeWidth="2.2" />
          <path d="M9 5c3.5 0 7 2 10 6l-2.5 1.5C14.5 9.5 12 8 9 7.5V5Z" fill="#707b85" stroke="#bcc7d1" strokeWidth="1.4" />
        </svg>
      );
    case 'spear':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20L15 9" stroke="#8a6845" strokeWidth="2" />
          <path d="M14 6l6-2-2 6-4-4Z" fill="#8996a1" stroke="#d0dbe3" strokeWidth="1.4" />
        </svg>
      );
    case 'sword':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18L18 6l1-2-2 1L5 17" fill="#9aa7b2" stroke="#dce5ed" strokeWidth="1.4" />
          <path d="M6 14l4 4M4.5 19.5l2-2" stroke="#c49552" strokeWidth="2" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.8-3 8.2-7 10-4-1.8-7-5.2-7-10V6l7-3Z" fill="#4f5a63" stroke="#b9c5cf" strokeWidth="1.5" />
          <path d="M12 6v12" stroke="#c7954b" strokeWidth="1.4" />
        </svg>
      );
    case 'armor':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinejoin="round">
          <path d="M7 5l2.5-1.5h5L17 5l2 4-2.5 1.5V19h-9v-8.5L5 9l2-4Z" fill="#5e4b3c" stroke="#bfa488" strokeWidth="1.5" />
          <path d="M12 6v13" stroke="#3d3025" strokeWidth="1.4" />
        </svg>
      );
    case 'cloak':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinejoin="round">
          <path d="M8 4h8l3 15-4-1.5L12 20l-3-2.5L5 19 8 4Z" fill="#4d5259" stroke="#a6b0ba" strokeWidth="1.5" />
          <path d="M8 4c1.5 2 6.5 2 8 0" stroke="#c9b89c" strokeWidth="1.8" />
        </svg>
      );
    case 'poultice':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <rect x="6" y="6" width="12" height="12" rx="2.5" fill="#708f64" stroke="#b9d6a9" strokeWidth="1.5" />
          <path d="M12 9v6M9 12h6" stroke="#ece6d6" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'ration':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 9l7-3 7 3v7l-7 3-7-3V9Z" fill="#7d5839" stroke="#c79b6b" strokeWidth="1.4" />
          <path d="M5 12h14" stroke="#d4a65c" strokeWidth="1.3" />
        </svg>
      );
    case 'broth':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round">
          <path d="M5 11h14a6 6 0 0 1-14 0Z" fill="#5b666e" stroke="#aeb9c2" strokeWidth="1.5" />
          <path d="M7 11h10" stroke="#c97d3b" strokeWidth="2.4" />
          <path d="M9 7c0-1.5 1-2 1-3M14 7c0-1.5 1-2 1-3" stroke="#cbd5de" strokeWidth="1.3" />
        </svg>
      );
    case 'ingot':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinejoin="round">
          <path d="M6 10l4-4h8l-4 4H6Z" fill="#8f9aa3" stroke="#cdd7df" strokeWidth="1.3" />
          <path d="M6 10h8v6H4l2-6Z" fill="#636d75" stroke="#a6b2bc" strokeWidth="1.3" />
          <path d="M14 10l4-4v6l-4 4v-6Z" fill="#4b5359" stroke="#939fa8" strokeWidth="1.3" />
        </svg>
      );
    case 'cordage':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <ellipse cx="12" cy="12" rx="6.5" ry="4.5" stroke="#a89060" strokeWidth="2.2" />
          <ellipse cx="12" cy="12" rx="3.5" ry="2" stroke="#7d6740" strokeWidth="1.6" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="12" r="4" fill="#463b29" stroke="#d8a852" strokeWidth="1.8" />
          <path d="M12 12h8M17 12v3M20 12v2.5" stroke="#d8a852" strokeWidth="1.9" />
        </svg>
      );
    case 'scroll':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#705a3c" stroke="#d9be8b" strokeWidth="1.4" />
          <path d="M9 9h6M9 12.5h6M9 16h4" stroke="#efe0be" strokeWidth="1.3" />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" fill="#5e4d36" stroke="#cfb482" strokeWidth="1.4" />
          <path d="M9 4v14M15 6v14" stroke="#9e8254" strokeWidth="1.2" />
          <path d="M11 10l3 3M14 10l-3 3" stroke="#e07a52" strokeWidth="1.4" />
        </svg>
      );
    case 'relic':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 3l6 9-6 9-6-9 6-9Z" fill="#c79546" stroke="#f5d28c" strokeWidth="1.5" />
        </svg>
      );
  }
};
