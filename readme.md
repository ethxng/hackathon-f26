# Title: Focus Up

## Rutgers Fall Hackathon 2026
## Group: Hieu Nguyen, Ethan Nguyen, Andy Mao, Veda Yakkali 

### Track: Education
### Superlatives: Best UI/UX & Use of ElevenLabs

# Description:


Create a study tool that helps the user manage stress and focus levels.

This is done by using Prasage's *SmartSpectra* to determinisitically analyze the user's breathing, cardio, and face metrics to determine stress levels and current focus.

Focus is determined via facial data. If the user turns away from the camera too often, talks too much, or has a "strange" facial expression, it could be inferred that the user is not focused. Otherwise, focus is being kept.

Stress is determined via breathing, cardio, and facial expression. If the user is breathing heavily, has a high heart rate, or has facial expressions that are considered "poor", the user can be considered as too over-stressed. A heart rate too low, and breathing too slow can be considered too under-stressed.


If the user is determined to be either too over/under stressed or un-focused, we make a Google Gemini call to generate text that informs the user of their state in a predefined style.

The generated text is fed into ElevenLabs API to speak towards the user, in the pre-defined voice and style.

