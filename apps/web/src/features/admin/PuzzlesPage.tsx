import { useState } from "react";
import {
  useAdminGames,
  useAdminPuzzles,
  useCreatePuzzle,
  useGeneratePuzzle,
  useUpdatePuzzle,
  useDeletePuzzle,
  type AdminPuzzleDTO,
} from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { Select } from "../../components/Select";
import { ApiClientError } from "../../lib/api-client";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "neutral",
};

const INPUT_CLASSES =
  "rounded-xl border border-white/[0.12] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function GameSelect({
  value,
  onChange,
  games,
  includeAll,
}: {
  value: string;
  onChange: (value: string) => void;
  games: { slug: string; name: string }[];
  includeAll?: boolean;
}) {
  const options = [
    ...(includeAll ? [{ value: "", label: "All games" }] : []),
    ...games.map((g) => ({ value: g.slug, label: g.name })),
  ];
  return <Select value={value} onChange={onChange} options={options} aria-label="Game" />;
}

function PuzzleEditor({ puzzle, onClose }: { puzzle: AdminPuzzleDTO; onClose: () => void }) {
  const [content, setContent] = useState(JSON.stringify(puzzle.content, null, 2));
  const [error, setError] = useState<string | null>(null);
  const updatePuzzle = useUpdatePuzzle();

  const save = async () => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      setError("Content must be valid JSON");
      return;
    }
    try {
      await updatePuzzle.mutateAsync({ id: puzzle.id, data: { content: parsed } });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-black/20 p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-white/[0.12] bg-white/[0.04] p-2 font-mono text-xs text-white/90"
      />
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" isLoading={updatePuzzle.isPending} onClick={() => void save()}>
          <Icon name="save" className="text-base" /> Save content
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose}>
          <Icon name="close" className="text-base" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export function PuzzlesPage() {
  const { data: games } = useAdminGames();
  const [filters, setFilters] = useState<{ gameSlug: string; date: string; status: string }>({
    gameSlug: "",
    date: "",
    status: "",
  });
  const { data: puzzles, isLoading } = useAdminPuzzles({
    gameSlug: filters.gameSlug || undefined,
    date: filters.date || undefined,
    status: filters.status || undefined,
  });

  const [generateForm, setGenerateForm] = useState({ gameSlug: "", date: todayInputValue() });
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generatePuzzle = useGeneratePuzzle();

  const [createForm, setCreateForm] = useState({
    gameSlug: "",
    date: todayInputValue(),
    status: "SCHEDULED",
    content: "{}",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const createPuzzle = useCreatePuzzle();

  const updatePuzzle = useUpdatePuzzle();
  const deletePuzzle = useDeletePuzzle();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminPuzzleDTO | null>(null);

  if (!games) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  const gameOptions = games.map((g) => ({ slug: g.slug, name: g.name }));

  const handleGenerate = async () => {
    setGenerateError(null);
    if (!generateForm.gameSlug) {
      setGenerateError("Choose a game first");
      return;
    }
    try {
      await generatePuzzle.mutateAsync(generateForm);
    } catch (err) {
      setGenerateError(err instanceof ApiClientError ? err.message : "Failed to generate");
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!createForm.gameSlug) {
      setCreateError("Choose a game first");
      return;
    }
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(createForm.content);
    } catch {
      setCreateError("Content must be valid JSON");
      return;
    }
    try {
      await createPuzzle.mutateAsync({ ...createForm, content: parsedContent });
      setCreateForm((prev) => ({ ...prev, content: "{}" }));
    } catch (err) {
      setCreateError(err instanceof ApiClientError ? err.message : "Failed to create");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card intensity="subtle">
          <h2 className="mb-3 font-display text-lg font-bold text-white">Generate a puzzle</h2>
          <p className="mb-3 text-xs text-white/50">
            Uses the game's real generator — only works for games with an engine module.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <GameSelect
              value={generateForm.gameSlug}
              onChange={(v) => setGenerateForm((p) => ({ ...p, gameSlug: v }))}
              games={gameOptions}
              includeAll
            />
            <input
              type="date"
              value={generateForm.date}
              onChange={(e) => setGenerateForm((p) => ({ ...p, date: e.target.value }))}
              className={INPUT_CLASSES}
            />
            <Button isLoading={generatePuzzle.isPending} onClick={() => void handleGenerate()}>
              <Icon name="auto_awesome" className="text-lg" /> Generate
            </Button>
          </div>
          {generateError ? <p className="mt-2 text-xs font-medium text-rose-400">{generateError}</p> : null}
        </Card>

        <Card intensity="subtle">
          <h2 className="mb-3 font-display text-lg font-bold text-white">Create manually</h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <GameSelect
                value={createForm.gameSlug}
                onChange={(v) => setCreateForm((p) => ({ ...p, gameSlug: v }))}
                games={gameOptions}
                includeAll
              />
              <input
                type="date"
                value={createForm.date}
                onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
                className={INPUT_CLASSES}
              />
              <Select
                value={createForm.status}
                onChange={(v) => setCreateForm((p) => ({ ...p, status: v }))}
                options={[
                  { value: "SCHEDULED", label: "Scheduled" },
                  { value: "PUBLISHED", label: "Published" },
                ]}
                aria-label="Status"
              />
            </div>
            <textarea
              value={createForm.content}
              onChange={(e) => setCreateForm((p) => ({ ...p, content: e.target.value }))}
              rows={4}
              placeholder="Puzzle content as JSON"
              className="w-full rounded-lg border border-white/[0.12] bg-white/[0.04] p-2 font-mono text-xs text-white/90 placeholder:text-white/30"
            />
            {createError ? <p className="text-xs font-medium text-rose-400">{createError}</p> : null}
            <Button isLoading={createPuzzle.isPending} onClick={() => void handleCreate()} className="self-start">
              <Icon name="add" className="text-lg" /> Create Puzzle
            </Button>
          </div>
        </Card>
      </div>

      <Card intensity="subtle">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-lg font-bold text-white">Puzzles</h2>
          <GameSelect
            value={filters.gameSlug}
            onChange={(v) => setFilters((p) => ({ ...p, gameSlug: v }))}
            games={gameOptions}
            includeAll
          />
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))}
            className={INPUT_CLASSES}
          />
          <Select
            value={filters.status}
            onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
            options={[
              { value: "", label: "All statuses" },
              { value: "SCHEDULED", label: "Scheduled" },
              { value: "PUBLISHED", label: "Published" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
            aria-label="Status filter"
          />
        </div>

        {isLoading || !puzzles ? (
          <Spinner className="mx-auto h-6 w-6 text-brand-400" />
        ) : puzzles.length === 0 ? (
          <p className="text-center text-sm text-white/50">No puzzles match these filters.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {puzzles.map((puzzle) => (
              <div key={puzzle.id} className="rounded-xl border border-white/[0.08] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-white/85">{puzzle.gameName}</span>
                  <span className="text-xs text-white/50">{puzzle.date}</span>
                  <span className="text-xs text-white/40">#{puzzle.puzzleNumber}</span>
                  <Badge tone={STATUS_TONE[puzzle.status] ?? "neutral"}>{puzzle.status}</Badge>
                  <div className="ml-auto flex gap-2">
                    {puzzle.status !== "PUBLISHED" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!h-11 !w-11 !px-0"
                        aria-label="Publish"
                        title="Publish"
                        onClick={() => updatePuzzle.mutate({ id: puzzle.id, data: { status: "PUBLISHED" } })}
                      >
                        <Icon name="publish" className="text-base" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!h-11 !w-11 !px-0"
                        aria-label="Unpublish"
                        title="Unpublish"
                        onClick={() => updatePuzzle.mutate({ id: puzzle.id, data: { status: "ARCHIVED" } })}
                      >
                        <Icon name="unpublished" className="text-base" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!h-11 !w-11 !px-0"
                      aria-label={editingId === puzzle.id ? "Close editor" : "Edit"}
                      title={editingId === puzzle.id ? "Close editor" : "Edit"}
                      onClick={() => setEditingId(editingId === puzzle.id ? null : puzzle.id)}
                    >
                      <Icon name={editingId === puzzle.id ? "close" : "edit"} className="text-base" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="!h-11 !w-11 !px-0"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => setPendingDelete(puzzle)}
                    >
                      <Icon name="delete" className="text-base" />
                    </Button>
                  </div>
                </div>
                {editingId === puzzle.id ? (
                  <PuzzleEditor puzzle={puzzle} onClose={() => setEditingId(null)} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.gameName ?? ""} puzzle #${pendingDelete?.puzzleNumber ?? ""}?`}
        body="This permanently removes the puzzle and cannot be undone."
        confirmLabel="Delete"
        danger
        isLoading={deletePuzzle.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deletePuzzle.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
