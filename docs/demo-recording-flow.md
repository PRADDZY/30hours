# 30hours Pune demo recording flow

Use this runbook to record the prepared Pune journey in a clean browser context. It covers the product interaction and the expected screen after each action; the recording agent handles its own capture controls.

## Recording target

- URL: https://30hours.dpratik3005.workers.dev/demo
- Viewport: 1440 x 900 desktop; keep the page at 100% zoom.
- Use a fresh browser profile or clear this site's local storage and IndexedDB first. No sign-in is required.
- Select English for narration. Keep the default History and Cities interests selected.
- The route is an illustrative 40-minute drive from Deccan Gymkhana to Hinjawadi Phase 1. The prepared audio is a four-minute sample, not a 40-minute episode.
- Keep the browser tab focused so the prepared audio can play. The quiz must be completed by typing; do not trigger microphone permission prompts.

## Flow

1. **Open the prepared Pune route.** Navigate to `/demo` and wait for the route builder to settle. Confirm the badge `PUNE DEMO · 40 MIN`, origin `Deccan Gymkhana, Pune`, destination `Hinjawadi Phase 1, Pune`, and the 40-minute summary. The selected route is preloaded; do not search for another place or change the travel mode.

2. **Set the narration language.** Scroll to `Shape your listen`. Click the `English` button under `LISTEN IN`. Confirm English is selected and `History` and `Cities` remain selected under `DRAW FROM YOUR INTERESTS`. Leave `Explore a topic` selected.

3. **Create the sample listen.** Click `Create my listen`. Expect the page to switch to the player and show `Why your brain needs a little boredom`, `A 4 MINUTE SAMPLE LISTEN`, `CHAPTER 01 OF 07`, and the Pune origin and destination. Wait until the opening chapter is playable and the play control changes to `Pause`.

4. **Show the Pune context and first narration.** Keep the route illustration and player visible while the opening narration mentions the Deccan Gymkhana to Hinjawadi drive. Pause after the opening chapter starts so the map, title, 40-minute arrival estimate, and player controls can be seen together.

5. **Show the transcript.** Click `Transcript`. Expect a dialog named `Your listen, in words`, with the seven chapter scripts and the Pune-specific opening text. Close it with `Close Your listen, in words`.

6. **Show the sources.** Click the player button named `2 sources`. Expect the `A little further reading` dialog with the two source links. Close it with `Close A little further reading`.

7. **Resume and hear the idea behind the quiz.** Click `Play`, then let `The cost of switching` finish. Wait until the active chapter heading changes to `When every answer is instant`; this confirms the switching chapter was heard and makes the first reflection question available.

8. **Hear the practical chapter.** In the chapter list, click `Try one small gap`. Let it finish and wait for `Take the idea with you` to begin. This records the lesson's practical concept so the second reflection question is available.

9. **Finish the prepared listen.** Let `Take the idea with you` finish. Expect the `A little reflection` dialog to open automatically with the first question: `What is one cost of repeatedly switching your attention?`

10. **Answer both reflection questions by typing.** In `#quiz-answer`, enter `My mind has to reorient to a new context, which uses time and attention.` Click `Send my answer` and wait for the feedback. Click `One more thought`. For the second question, enter `Before I unlock my phone, I can ask what I am looking for. If I am unsure, I can leave one minute unfilled and then choose.` Click `Send my answer`, wait for feedback, then click `Finish reflection`.

11. **End on the result.** Confirm the dialog says `A new perspective, kept.` and displays the graded reflection result. Hold on this screen briefly, then end the recording.

## Recovery checks

- If the route badge or either Pune location is missing, reload `/demo` once and wait for the route builder; do not continue with a stale route.
- If `Create my listen` is disabled, wait for route selection to finish. If it stays disabled, reload `/demo` once.
- If English is not selected, click it before creating the listen. The prepared opening audio exists for English, Hindi, and Hinglish.
- If the quiz opens with no question, return to the listen only if the dialog offers a close action, play the required chapters (`The cost of switching` and `Try one small gap`) to completion, then finish `Take the idea with you`.
- Do not claim the prepared four-minute sample fills the full forty-minute journey. The page labels it as a sample listen.
