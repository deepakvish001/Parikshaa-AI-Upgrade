// The unfinished "fit" lens of w2. Resumable: the agent writes its own output file, and skips if it is already complete.
export const meta = {
  name: 'hire-fit-critique',
  description: 'Check the Hire v2 design against the real code (service signatures, wiring, slice order)',
  phases: [{ title: 'Fit' }],
}

phase('Fit')
const out = await agent(`Repo: the current working directory (Parikshaa monorepo).
If docs/hire/critique-fit.md already exists and ends with the line "<!-- complete -->", do nothing and return "already done".
Otherwise follow the prompt in docs/hire/critique-fit-prompt.md exactly. Write the result to docs/hire/critique-fit.md as you go: add each issue as soon as it is verified, so a session that stops keeps the finished part. When everything is checked, end the file with the line "<!-- complete -->".
Then add the changes that are needed to docs/HIRE-V2.md §10, in a new sub-section "Fit (F#)", and return a short summary.`, { label: 'critic:fit', phase: 'Fit' })
return out
