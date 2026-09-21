import type { ExamSummary } from "../api.ts";

interface Props {
  readonly exams: readonly ExamSummary[];
  readonly onOpen: (examId: string) => void;
  readonly onEdit: (examId: string) => void;
  readonly onNew: () => void;
}

export function ExamList({ exams, onOpen, onEdit, onNew }: Props) {
  return (
    <section className="card">
      <div className="bar">
        <strong>Exams</strong>
        <span className="spacer" />
        <button type="button" onClick={onNew}>
          New exam
        </button>
      </div>

      {exams.length === 0 ? (
        <p className="notice">No exams yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Questions</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td>
                  <button type="button" className="crumb" onClick={() => onOpen(exam.id)}>
                    {exam.title}
                  </button>
                </td>
                <td>{exam.questionCount}</td>
                <td>
                  <button type="button" className="quiet" onClick={() => onEdit(exam.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
