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
import { IconButton } from "../../components/IconButton";
import { GameIcon } from "../../components/GameIcon";
import { SectionHeader } from "../../components/SectionHeader";
import { FIELD_BORDER, FIELD_CLASSES } from "../../components/field-styles";
import { ApiClientError } from "../../lib/api-client";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "neutral",
};

const INPUT_CLASSES = `${FIELD_CLASSES} ${FIELD_BORDER} !w-auto px-3.5 [color-scheme:dark]`;
const TEXTAREA_CLASSES =
  "w-full rounded-xl border border-white/[0.1] bg-black/30 p-3 font-mono text-xs leading-relaxed text-white/90 outline-none transition-[border-color,box-shadow] placeholder:text-white/30 focus:border-accent-400/70 focus:ring-4 focus:ring-accent-400/15";

/** Puzzles shown per page — the full list runs to hundreds of rows. */
const PUZZLES_PER_PAGE = 20;

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
    <div className="surface-inset mt-3 flex flex-col gap-3 p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
        className={TEXTAREA_CLASSES}
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
  const [page, setPage] = useState(0);
  const updateFilters = (patch: Partial<typeof filters>) => {
    setFilters((p) => ({ ...p, ...patch }));
    setPage(0);
  };
  const pageCount = Math.max(1, Math.ceil((puzzles?.length ?? 0) / PUZZLES_PER_PAGE));
  // Deleting the last row of the last page shouldn't strand you on an empty page.
  const currentPage = Math.min(page, pageCount - 1);
  const visiblePuzzles = (puzzles ?? []).slice(
    currentPage * PUZZLES_PER_PAGE,
    (currentPage + 1) * PUZZLES_PER_PAGE,
  );
  const firstShown = currentPage * PUZZLES_PER_PAGE + 1;
  const lastShown = currentPage * PUZZLES_PER_PAGE + visiblePuzzles.length;

  const [generateForm, setGenerateForm] = useState({ gameSlug: "", date: todayInputValue() });
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSummary, setGenerateSummary] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
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
        <Spinner className="h-8 w-8 text-accent-400" />
      </div>
    );
  }

  const gameOptions = games.map((g) => ({ slug: g.slug, name: g.name }));

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerateSummary(null);

    // "All games" (an empty gameSlug) means every game, not "no game chosen" — generate one at a
    // time, treating a game with no generator module or one that already has a puzzle for this
    // date as a skip rather than a failure, since those are expected, not errors.
    if (!generateForm.gameSlug) {
      setGeneratingAll(true);
      const generated: string[] = [];
      const skipped: string[] = [];
      const failed: string[] = [];
      try {
        for (const game of gameOptions) {
          try {
            await generatePuzzle.mutateAsync({ gameSlug: game.slug, date: generateForm.date });
            generated.push(game.name);
          } catch (err) {
            if (err instanceof ApiClientError && (err.status === 400 || err.status === 409)) {
              skipped.push(game.name);
            } else {
              failed.push(game.name);
            }
          }
        }
      } finally {
        setGeneratingAll(false);
      }
      setGenerateSummary(
        `Generated ${generated.length} of ${gameOptions.length} puzzle${gameOptions.length === 1 ? "" : "s"}` +
          (skipped.length > 0
            ? ` — skipped ${skipped.join(", ")} (already exists or no generator)`
            : ""),
      );
      if (failed.length > 0) setGenerateError(`Failed to generate for: ${failed.join(", ")}`);
      return;
    }

    try {
      const created = await generatePuzzle.mutateAsync(generateForm);
      setGenerateSummary(`Generated a puzzle for ${created.gameSlug}.`);
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
        <Card>
          <SectionHeader title="Generate a puzzle" icon="auto_awesome" />
          <p className="mb-3 text-xs text-fg-subtle">
            Uses the game's real generator — only works for games with an engine module. Choose "All
            games" to generate every game's puzzle for that date at once, skipping any that already
            have one or don't have a generator.
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
              aria-label="Date to generate for"
              onChange={(e) => setGenerateForm((p) => ({ ...p, date: e.target.value }))}
              className={INPUT_CLASSES}
            />
            <Button
              isLoading={generatingAll || generatePuzzle.isPending}
              onClick={() => void handleGenerate()}
            >
              <Icon name="auto_awesome" className="text-lg" /> Generate
            </Button>
          </div>
          {generateError ? (
            <p className="mt-2 text-xs font-medium text-rose-400">{generateError}</p>
          ) : null}
          {generateSummary ? (
            <p className="mt-2 text-xs font-medium text-emerald-400">{generateSummary}</p>
          ) : null}
        </Card>

        <Card>
          <SectionHeader
            title="Create manually"
            icon="edit_note"
            description="Paste content as JSON; it's checked against the game's schema."
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <GameSelect
                value={createForm.gameSlug}
                onChange={(v) => setCreateForm((p) => ({ ...p, gameSlug: v }))}
                games={gameOptions}
              />
              <input
                type="date"
                value={createForm.date}
                aria-label="Puzzle date"
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
              className={TEXTAREA_CLASSES}
            />
            {createError ? (
              <p className="text-xs font-medium text-rose-400">{createError}</p>
            ) : null}
            <Button
              isLoading={createPuzzle.isPending}
              onClick={() => void handleCreate()}
              className="self-start"
            >
              <Icon name="add" className="text-lg" /> Create Puzzle
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SectionHeader
            title="Puzzles"
            icon="extension"
            className="mr-auto"
            action={
              puzzles ? (
                <span className="eyebrow ml-2 text-fg-subtle">{puzzles.length} total</span>
              ) : null
            }
          />
          <GameSelect
            value={filters.gameSlug}
            onChange={(v) => updateFilters({ gameSlug: v })}
            games={gameOptions}
            includeAll
          />
          <input
            type="date"
            value={filters.date}
            aria-label="Filter by date"
            onChange={(e) => updateFilters({ date: e.target.value })}
            className={INPUT_CLASSES}
          />
          <Select
            value={filters.status}
            onChange={(v) => updateFilters({ status: v })}
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
          <Spinner className="mx-auto h-6 w-6 text-accent-400" />
        ) : puzzles.length === 0 ? (
          <p className="text-center text-sm text-fg-subtle">No puzzles match these filters.</p>
        ) : (
          <>
            <ul className="flex flex-col">
              {visiblePuzzles.map((puzzle) => (
                <li
                  key={puzzle.id}
                  className="border-t border-white/[0.05] py-2.5 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex min-w-[10rem] items-center gap-2.5">
                      <GameIcon slug={puzzle.gameSlug} size="sm" />
                      <span className="text-sm font-semibold text-white/85">{puzzle.gameName}</span>
                    </span>
                    <span className="tabular font-mono text-xs text-fg-muted">{puzzle.date}</span>
                    <span className="tabular font-mono text-xs text-fg-subtle">
                      #{puzzle.puzzleNumber}
                    </span>
                    <Badge tone={STATUS_TONE[puzzle.status] ?? "neutral"}>
                      {puzzle.status.toLowerCase()}
                    </Badge>
                    <div className="ml-auto flex gap-1.5">
                      {puzzle.status !== "PUBLISHED" ? (
                        <IconButton
                          icon="publish"
                          label="Publish"
                          onClick={() =>
                            updatePuzzle.mutate({ id: puzzle.id, data: { status: "PUBLISHED" } })
                          }
                        />
                      ) : (
                        <IconButton
                          icon="unpublished"
                          label="Unpublish"
                          onClick={() =>
                            updatePuzzle.mutate({ id: puzzle.id, data: { status: "ARCHIVED" } })
                          }
                        />
                      )}
                      <IconButton
                        icon={editingId === puzzle.id ? "close" : "edit"}
                        label={editingId === puzzle.id ? "Close editor" : "Edit"}
                        onClick={() => setEditingId(editingId === puzzle.id ? null : puzzle.id)}
                      />
                      <IconButton
                        icon="delete"
                        label="Delete"
                        tone="danger"
                        onClick={() => setPendingDelete(puzzle)}
                      />
                    </div>
                  </div>
                  {editingId === puzzle.id ? (
                    <PuzzleEditor puzzle={puzzle} onClose={() => setEditingId(null)} />
                  ) : null}
                </li>
              ))}
            </ul>
            {pageCount > 1 ? (
              <nav
                aria-label="Puzzle pages"
                className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4"
              >
                <span className="tabular font-mono text-xs text-fg-subtle">
                  {firstShown}–{lastShown} of {puzzles.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="arrow_back" className="text-base" /> Previous
                  </Button>
                  <span className="tabular font-mono text-xs text-fg-muted">
                    {currentPage + 1} / {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next <Icon name="arrow_forward" className="text-base" />
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
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
