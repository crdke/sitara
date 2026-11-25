// All languages Sitara can speak.
// To add a language later (for example Tamil):
//   1. Copy en.js to ta.js and translate the text.
//   2. Set code: 'ta', nativeName: 'தமிழ்', speech: 'ta-IN', locale: 'ta-IN'.
//   3. Import it below and add it to the LANGUAGES list.
import en from './en.js';
import hi from './hi.js';
import ml from './ml.js';
import mr from './mr.js';

export const LANGUAGES = [en, hi, ml, mr];
