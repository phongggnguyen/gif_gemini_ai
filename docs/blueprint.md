# **App Name**: DoodleGIF

## Core Features:

- Prompt Refinement: Prompt Expansion Tool: Uses Gemini API to refine the user's prompt into a more detailed description suitable for generating doodle-style images.
- Image Generation: Frame Generation: Employs Gemini API to generate a series of doodle-style image frames based on the refined prompt, designed to create an animated effect when assembled into a GIF.
- GIF Assembly: GIF Creation: Assembles the generated frames into a single animated GIF using the gifenc library.
- Prompt Input: User Input: Text field for users to enter their prompt. The input has a default value, a placeholder, and a 'magic wand' icon.
- GIF Display: Output Display: Displays the generated GIF, divided in a Frame tab (shows individual frames) and an Output tab (shows resulting GIF).
- GIF Download: Download Button: Allows users to download the created GIF to their device. Positioned on the bottom right corner of the GIF.
- Progress Tracking: Status Updates: Provides real-time feedback on the generation process (e.g., 'Generating frames...', 'Creating GIF...', 'Done!').

## Style Guidelines:

- Primary color: Light purple (#A092F2). It conveys creativity and magic, complementing the app's purpose.
- Background color: Very light purple (#F4F2FE). It ensures a gentle contrast, ideal for a light theme.
- Accent color: Light pink (#F292D4). Offers a playful contrast that enhances user interaction without being distracting.
- Body and headline font: 'Inter', a sans-serif font that will convey a clean and modern aesthetic, fitting the doodle-style output.
- Use Font Awesome icons to enhance user interface elements (wand, sparkles, download).
- A tabbed interface to divide the frames view from the final GIF view. Place status updates at the bottom of the page.
- Implement subtle animations for loading states, tab transitions, and frame appearances to enhance user experience.