import { DraftingForm } from './components/drafting-form'

export default function DraftingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quick Drafting</h1>
        <p className="text-muted-foreground">
          Generate cover letters from job descriptions. Paste a job description and the AI will create a tailored cover letter.
        </p>
      </div>

      <DraftingForm />
    </div>
  )
}

