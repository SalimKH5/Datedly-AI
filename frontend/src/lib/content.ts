// Localised help content: example prompts, recipes, guides.
import type { Lang } from "./i18n";

export const EXAMPLES: Record<Lang, string[]> = {
  en: [
    "A 24-day MMA Advent calendar with daily challenges, quizzes, historical facts and discoveries",
    "A 30-day beginner fitness calendar with daily activities and short lessons",
    "A 14-day Python course, from fundamentals to advanced concepts",
    "A 7-day travel discovery calendar for Paris",
    "A 12-month marketing calendar for a small bakery",
  ],
  fr: [
    "Un calendrier de l'Avent MMA de 24 jours avec défis, quiz, faits historiques et découvertes",
    "Un programme de remise en forme de 30 jours pour débutants, avec une activité par jour",
    "Un cours de Python en 14 jours, des bases aux notions avancées",
    "Un calendrier de 7 jours pour découvrir Paris",
    "Un calendrier marketing de 12 mois pour une petite boulangerie",
  ],
};

export interface Recipe {
  category: string;
  title: string;
  prompt: string;
}

export const RECIPES: Record<Lang, Recipe[]> = {
  en: [
    { category: "Advent", title: "Family Advent", prompt: "A 24-day Advent calendar for a family with kids aged 6 to 10: a short story, a riddle or a 10-minute activity each day, with a big highlight on December 24." },
    { category: "Learning", title: "Learn a skill", prompt: "A 21-day calendar to learn the basics of photography with a smartphone, for complete beginners: one short lesson and one practical exercise per day." },
    { category: "Sport", title: "Training plan", prompt: "A 30-day running plan for beginners going from 0 to 5 km, with a daily session, one motivation tip and rest days." },
    { category: "Business", title: "Editorial plan", prompt: "A 12-week social media calendar for a small coffee shop: one post idea per week with a hook, the format and a call to action." },
    { category: "Team", title: "Team rituals", prompt: "A 20-day calendar of 5-minute team-building challenges for a remote team, light and inclusive, never embarrassing." },
    { category: "Culture", title: "Discover a country", prompt: "A 14-day calendar to discover Japan: a fact, a word of Japanese, a dish or a place each day, for curious adults." },
    { category: "Kids", title: "Science for kids", prompt: "A 10-day science calendar for 8-year-olds with simple experiments at home, safe and using everyday objects, flag anything that needs an adult." },
    { category: "Wellbeing", title: "Mindful month", prompt: "A 31-day wellbeing calendar: a 2-minute breathing exercise, a gratitude question or a small kind act each day, warm and simple tone." },
  ],
  fr: [
    { category: "Avent", title: "L'Avent en famille", prompt: "Un calendrier de l'Avent de 24 jours pour une famille avec des enfants de 6 à 10 ans : une courte histoire, une devinette ou une activité de 10 minutes chaque jour, avec un temps fort le 24 décembre." },
    { category: "Apprendre", title: "Apprendre une compétence", prompt: "Un calendrier de 21 jours pour apprendre les bases de la photo au smartphone, pour grands débutants : une courte leçon et un exercice pratique par jour." },
    { category: "Sport", title: "Plan d'entraînement", prompt: "Un plan de course à pied de 30 jours pour débutants, de 0 à 5 km, avec une séance par jour, une astuce de motivation et des jours de repos." },
    { category: "Business", title: "Plan éditorial", prompt: "Un calendrier de 12 semaines pour les réseaux sociaux d'un petit café : une idée de publication par semaine avec une accroche, le format et un appel à l'action." },
    { category: "Équipe", title: "Rituels d'équipe", prompt: "Un calendrier de 20 jours de défis de cohésion de 5 minutes pour une équipe à distance, légers et inclusifs, jamais gênants." },
    { category: "Culture", title: "Découvrir un pays", prompt: "Un calendrier de 14 jours pour découvrir le Japon : un fait, un mot de japonais, un plat ou un lieu chaque jour, pour des adultes curieux." },
    { category: "Enfants", title: "Sciences pour enfants", prompt: "Un calendrier de 10 jours de sciences pour des enfants de 8 ans avec des expériences simples à la maison, sans danger, avec des objets du quotidien ; signaler ce qui demande un adulte." },
    { category: "Bien-être", title: "Un mois apaisé", prompt: "Un calendrier bien-être de 31 jours : un exercice de respiration de 2 minutes, une question de gratitude ou un petit geste gentil chaque jour, ton chaleureux et simple." },
  ],
};

export const CHECKLIST: Record<Lang, { title: string; body: string }[]> = {
  en: [
    { title: "The topic", body: "What is it about? Be specific: “MMA history” beats “sport”." },
    { title: "The audience", body: "Who reads it, and at what level: kids, beginners, experts, a team." },
    { title: "The length", body: "“24 days”, “12 weeks”, “12 months”. The rhythm follows (daily, weekly, monthly)." },
    { title: "The formats", body: "Quizzes, challenges, facts, stories, recipes, lessons… Mix 2 to 4." },
    { title: "The tone", body: "Fun, warm, serious, offbeat. One word is enough." },
    { title: "One special wish", body: "A highlight on the last day, no screen time, safe for kids, a start date…" },
  ],
  fr: [
    { title: "Le sujet", body: "De quoi ça parle ? Soyez précis : « l'histoire du MMA » plutôt que « le sport »." },
    { title: "Le public", body: "Qui lit, et à quel niveau : enfants, débutants, experts, une équipe." },
    { title: "La durée", body: "« 24 jours », « 12 semaines », « 12 mois ». Le rythme suit (quotidien, hebdo, mensuel)." },
    { title: "Les formats", body: "Quiz, défis, faits, histoires, recettes, leçons… Mélangez-en 2 à 4." },
    { title: "Le ton", body: "Drôle, tendre, sérieux, décalé. Un mot suffit." },
    { title: "Un souhait particulier", body: "Un temps fort le dernier jour, sans écran, sans danger pour les enfants, une date de début…" },
  ],
};

export const MODEL_GUIDE: Record<Lang, { name: string; verdict: string; body: string }[]> = {
  en: [
    { name: "qwen2.5:7b", verdict: "Recommended", body: "Best results in our tests: follows the format, varied content, good French and English. About 1 min per 6 entries." },
    { name: "qwen3:8b · llama3.1:8b", verdict: "Good", body: "Solid alternatives. Slightly slower." },
    { name: "mistral-nemo · hermes3", verdict: "OK", body: "Work well for creative tones, sometimes less precise on quizzes." },
    { name: "llama3.2 (3B)", verdict: "Fast", body: "Quick drafts, but repeats itself more. Good to test an idea." },
  ],
  fr: [
    { name: "qwen2.5:7b", verdict: "Recommandé", body: "Les meilleurs résultats dans nos tests : respecte le format, contenu varié, bon en français et en anglais. Environ 1 min pour 6 cases." },
    { name: "qwen3:8b · llama3.1:8b", verdict: "Bon", body: "De bonnes alternatives. Un peu plus lentes." },
    { name: "mistral-nemo · hermes3", verdict: "Correct", body: "Bien pour les tons créatifs, parfois moins précis sur les quiz." },
    { name: "llama3.2 (3B)", verdict: "Rapide", body: "Brouillons rapides, mais se répète davantage. Bien pour tester une idée." },
  ],
};

export const EDITING_TIPS: Record<Lang, string[]> = {
  en: [
    "Open a calendar, then the Edit tab. Pick an entry on the left to edit it on the right.",
    "Rewrite with AI: type an instruction (“shorter”, “turn it into a quiz”) or use a quick chip. The new version replaces the entry in your draft; nothing is saved until you click Save.",
    "Reorder by dragging an entry, or with the arrows. Dates stay in order: the entry you move takes the date of its new position.",
    "Change the schedule (first date, rhythm) to move every date at once.",
    "For a quiz, tick the right answer. A quiz without a correct answer cannot be saved.",
    "Local models can be wrong on facts, names and dates: read every entry before publishing.",
  ],
  fr: [
    "Ouvrez un calendrier, puis l'onglet Modifier. Choisissez une case à gauche pour la modifier à droite.",
    "Réécrire avec l'IA : tapez une consigne (« plus court », « en faire un quiz ») ou utilisez un raccourci. La nouvelle version remplace la case dans votre brouillon ; rien n'est enregistré avant de cliquer sur Enregistrer.",
    "Réordonnez en faisant glisser une case, ou avec les flèches. Les dates restent dans l'ordre : la case déplacée prend la date de sa nouvelle place.",
    "Modifiez le planning (première date, rythme) pour déplacer toutes les dates d'un coup.",
    "Pour un quiz, cochez la bonne réponse. Un quiz sans bonne réponse ne peut pas être enregistré.",
    "Les modèles locaux peuvent se tromper sur les faits, les noms et les dates : relisez chaque case avant de publier.",
  ],
};

export const SHORTCUTS: Record<Lang, [string, string][]> = {
  en: [
    ["Ctrl + Enter", "Generate from the prompt box"],
    ["Ctrl + S", "Save the calendar in the editor"],
    ["Esc", "Close an entry or a dialog"],
    ["Tab / Shift + Tab", "Move between fields"],
  ],
  fr: [
    ["Ctrl + Entrée", "Générer depuis la zone de texte"],
    ["Ctrl + S", "Enregistrer le calendrier dans l'éditeur"],
    ["Échap", "Fermer une case ou une fenêtre"],
    ["Tab / Maj + Tab", "Passer d'un champ à l'autre"],
  ],
};

export const TROUBLE: Record<Lang, { q: string; a: string; code?: string }[]> = {
  en: [
    { q: "“The local studio is not running”", a: "Start the Rust API in the backend folder, then refresh the page.", code: "cd backend && cargo run" },
    { q: "“Ollama not reachable”", a: "Start Ollama (open the app, or run the command below), then click the refresh icon in the AI engine card.", code: "ollama serve" },
    { q: "No model in the list", a: "Install a text model, then refresh.", code: "ollama pull qwen2.5:7b" },
    { q: "Generation is very slow", a: "Pick a smaller model, close other heavy apps, or ask for fewer entries. The first call also loads the model in memory." },
    { q: "Entries repeat or facts look wrong", a: "Try qwen2.5:7b, make your prompt more specific, then rewrite single entries with an instruction." },
  ],
  fr: [
    { q: "« Le studio local n'est pas lancé »", a: "Lancez l'API Rust dans le dossier backend, puis actualisez la page.", code: "cd backend && cargo run" },
    { q: "« Ollama injoignable »", a: "Lancez Ollama (ouvrez l'application, ou la commande ci-dessous), puis cliquez sur l'icône d'actualisation de la carte Moteur IA.", code: "ollama serve" },
    { q: "Aucun modèle dans la liste", a: "Installez un modèle de texte, puis actualisez.", code: "ollama pull qwen2.5:7b" },
    { q: "La génération est très lente", a: "Choisissez un modèle plus petit, fermez les applications lourdes, ou demandez moins de cases. Le premier appel charge aussi le modèle en mémoire." },
    { q: "Des cases se répètent ou des faits semblent faux", a: "Essayez qwen2.5:7b, précisez votre prompt, puis faites réécrire les cases une par une avec une consigne." },
  ],
};

export const FORMATS: Record<Lang, string[]> = {
  en: ["quizzes", "challenges", "facts", "stories", "activities", "recipes", "lessons", "recommendations"],
  fr: ["quiz", "défis", "faits", "histoires", "activités", "recettes", "leçons", "recommandations"],
};

export const TONES: Record<Lang, string[]> = {
  en: ["fun", "warm", "serious", "offbeat", "motivating"],
  fr: ["drôle", "tendre", "sérieux", "décalé", "motivant"],
};

export function buildPrompt(
  lang: Lang,
  p: { topic: string; audience: string; count: number; unit: "day" | "week" | "month"; formats: string[]; tone: string; extra: string },
): string {
  if (!p.topic.trim()) return "";
  const n = Math.max(1, Math.min(60, p.count || 1));
  if (lang === "fr") {
    const unit = { day: "jours", week: "semaines", month: "mois" }[p.unit];
    let s = `Un calendrier de ${n} ${unit} sur ${p.topic.trim()}`;
    if (p.audience.trim()) s += `, pour ${p.audience.trim()}`;
    if (p.formats.length) s += `, avec ${joinFr(p.formats)}`;
    s += ".";
    if (p.tone) s += ` Ton ${p.tone}.`;
    if (p.extra.trim()) s += ` ${capital(p.extra.trim())}.`;
    return s.replace(/\.\.$/, ".");
  }
  const unit = { day: "day", week: "week", month: "month" }[p.unit];
  let s = `A ${n}-${unit} calendar about ${p.topic.trim()}`;
  if (p.audience.trim()) s += ` for ${p.audience.trim()}`;
  if (p.formats.length) s += `, with ${joinEn(p.formats)}`;
  s += ".";
  if (p.tone) s += ` ${capital(p.tone)} tone.`;
  if (p.extra.trim()) s += ` ${capital(p.extra.trim())}.`;
  return s.replace(/\.\.$/, ".");
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinEn = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
const joinFr = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} et ${a.at(-1)}`);

export interface GuideStep {
  title: string;
  body: string;
  tip?: string;
  code?: string;
  href?: string;
  cta?: string;
}

/** Step-by-step "how to use the app" guide shown in the toolkit. */
export const GUIDE: Record<Lang, GuideStep[]> = {
  en: [
    {
      title: "Start the studio",
      body: "Datedly runs on your computer. Open two terminals: one for the Rust API, one for the interface, then open http://localhost:3000.",
      code: "cd backend && cargo run\ncd frontend && npm run dev",
      tip: "If the home page says “The local studio is not running”, the first command is not running.",
    },
    {
      title: "Connect the AI",
      body: "Start Ollama and install at least one text model. The AI engine card on the home page turns green (“Ollama connected”) and lists your models: pick one.",
      code: "ollama pull qwen2.5:7b",
      tip: "qwen2.5:7b gives the best results. Smaller models are faster but repeat themselves more.",
      href: "/#ai",
      cta: "Open the AI engine",
    },
    {
      title: "Describe your idea",
      body: "In “Create a calendar”, write one or two sentences: the topic, for whom, how long, which formats, which tone. Click an example to start faster.",
      tip: "Advanced settings let you force the number of entries, the start date or the language. Leave them empty and the AI decides.",
      href: "/#create",
      cta: "Write my idea",
    },
    {
      title: "Watch it being built",
      body: "Click Generate calendar (or Ctrl+Enter). Five steps light up: Understand, Plan, Write, Check, Build. The plan appears as soon as it is ready.",
      tip: "Count about 1 minute per 6 entries. You can reload the page: the progress comes back.",
    },
    {
      title: "Review the preview",
      body: "Click “Open my calendar”. Entries are grouped by section; click a tile to read it, answer the quizzes, check the facts.",
      tip: "Yellow notes list what the checker found (similar entries, entries to complete).",
      href: "/#calendars",
      cta: "See my calendars",
    },
    {
      title: "Edit what you want",
      body: "Switch to the Edit tab. Change the title, the theme and the schedule at the top; pick an entry on the left to edit its text, quiz, steps or links on the right. Drag entries to reorder them.",
      tip: "Dates follow the schedule: moving an entry gives it the date of its new place.",
    },
    {
      title: "Rewrite with AI, then save",
      body: "On any entry, type an instruction (“make it easier”, “turn it into a quiz”) or click a quick button. Review the new version, then click Save or press Ctrl+S.",
      tip: "Nothing is stored until you save. “Regenerate all” rewrites the whole calendar from your original idea.",
    },
    {
      title: "Publish (coming next)",
      body: "Soon you will publish the calendar: each entry unlocks on its date, checked by the server, so visitors can never read tomorrow's surprise today.",
    },
  ],
  fr: [
    {
      title: "Lancer le studio",
      body: "Datedly tourne sur votre ordinateur. Ouvrez deux terminaux : un pour l'API Rust, un pour l'interface, puis ouvrez http://localhost:3000.",
      code: "cd backend && cargo run\ncd frontend && npm run dev",
      tip: "Si l'accueil affiche « Le studio local n'est pas lancé », c'est la première commande qui ne tourne pas.",
    },
    {
      title: "Brancher l'IA",
      body: "Lancez Ollama et installez au moins un modèle de texte. La carte Moteur IA de l'accueil passe au vert (« Ollama connecté ») et liste vos modèles : choisissez-en un.",
      code: "ollama pull qwen2.5:7b",
      tip: "qwen2.5:7b donne les meilleurs résultats. Les petits modèles sont plus rapides mais se répètent davantage.",
      href: "/#ai",
      cta: "Ouvrir le moteur IA",
    },
    {
      title: "Décrire votre idée",
      body: "Dans « Créer un calendrier », écrivez une ou deux phrases : le sujet, pour qui, la durée, les formats, le ton. Cliquez sur un exemple pour aller plus vite.",
      tip: "Les réglages avancés imposent le nombre de cases, la date de début ou la langue. Laissez-les vides : l'IA décide.",
      href: "/#create",
      cta: "Écrire mon idée",
    },
    {
      title: "Le regarder se construire",
      body: "Cliquez sur Générer le calendrier (ou Ctrl+Entrée). Cinq étapes s'allument : Comprendre, Planifier, Rédiger, Vérifier, Assembler. Le plan s'affiche dès qu'il est prêt.",
      tip: "Comptez environ 1 minute pour 6 cases. Vous pouvez recharger la page : la progression revient.",
    },
    {
      title: "Relire l'aperçu",
      body: "Cliquez sur « Ouvrir mon calendrier ». Les cases sont rangées par section ; cliquez sur une case pour la lire, répondre aux quiz, vérifier les faits.",
      tip: "Les encadrés jaunes listent ce que la vérification a trouvé (cases proches, cases à compléter).",
      href: "/#calendars",
      cta: "Voir mes calendriers",
    },
    {
      title: "Modifier ce que vous voulez",
      body: "Passez sur l'onglet Modifier. En haut : titre, thème et planning ; à gauche, choisissez une case pour modifier à droite son texte, son quiz, ses étapes ou ses liens. Faites glisser les cases pour les réordonner.",
      tip: "Les dates suivent le planning : une case déplacée prend la date de sa nouvelle place.",
    },
    {
      title: "Réécrire avec l'IA, puis enregistrer",
      body: "Sur une case, tapez une consigne (« plus simple », « en faire un quiz ») ou cliquez sur un raccourci. Relisez la nouvelle version, puis cliquez sur Enregistrer ou faites Ctrl+S.",
      tip: "Rien n'est gardé avant l'enregistrement. « Tout régénérer » réécrit tout le calendrier à partir de votre idée de départ.",
    },
    {
      title: "Publier (bientôt)",
      body: "Bientôt, vous publierez le calendrier : chaque case s'ouvrira à sa date, vérifiée par le serveur, pour que personne ne lise la surprise de demain dès aujourd'hui.",
    },
  ],
};
