import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Check,
  Trash2,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useAddFinancialTransaction,
  useFinancialTransactions,
  useUpdateFinancialTransaction,
  useDeleteFinancialTransaction,
  useInvalidateAll,
  useStudents,
} from "@/hooks/useMusicData";
import type { FinancialTransaction } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  FilterPill,
  EmptyState,
} from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · MusicCRM" },
      {
        name: "description",
        content: "Gestão financeira, mensalidades, fluxo de caixa e inadimplência.",
      },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const [month, setMonth] = useState(getCurrentMonth);
  const { data: transactions = [] } = useFinancialTransactions(month);
  const { data: students = [] } = useStudents();
  const addTransaction = useAddFinancialTransaction();
  const updateTransaction = useUpdateFinancialTransaction();
  const deleteTransaction = useDeleteFinancialTransaction();

  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">(
    "todos",
  );
  const [openModal, setOpenModal] = useState(false);
  const [legacyTransactions, setLegacyTransactions] = useState<FinancialTransaction[]>([]);
  const [importingLegacy, setImportingLegacy] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("maestro_transactions");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<FinancialTransaction>[];
      if (!Array.isArray(parsed)) return;
      const demoIds = new Set(["tx-1", "tx-2", "tx-3", "tx-4", "tx-5"]);
      setLegacyTransactions(
        parsed.filter(
          (item): item is FinancialTransaction =>
            typeof item.id === "string" &&
            !demoIds.has(item.id) &&
            typeof item.description === "string" &&
            typeof item.amount === "number" &&
            typeof item.due_date === "string",
        ),
      );
    } catch {
      setLegacyTransactions([]);
    }
  }, []);

  const importLegacyTransactions = async () => {
    if (!user || legacyTransactions.length === 0) return;
    setImportingLegacy(true);
    const rows = legacyTransactions.map((transaction) => ({
      teacher_id: user.id,
      student_id: transaction.student_id ?? null,
      student_program_id: transaction.student_program_id ?? null,
      student_name: transaction.student_name ?? null,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      status: transaction.status,
      payment_method: transaction.payment_method,
      competence_date: transaction.competence_date || `${transaction.due_date.slice(0, 7)}-01`,
      due_date: transaction.due_date,
      paid_at: transaction.paid_at ?? null,
      source_key: `legacy:${transaction.id}`,
    }));
    const { error } = await supabase
      .from("financial_transactions")
      .upsert(rows, { onConflict: "teacher_id,source_key", ignoreDuplicates: true });
    setImportingLegacy(false);
    if (error) {
      toast.error(getErrorMessage(error, "Não foi possível importar os lançamentos antigos."));
      return;
    }
    localStorage.removeItem("maestro_transactions");
    setLegacyTransactions([]);
    invalidate();
    toast.success("Lançamentos antigos importados para o financeiro.");
  };

  const markAsPaid = (tx: FinancialTransaction) => {
    updateTransaction.mutate(
      { id: tx.id, status: "pago", paid_at: new Date().toISOString() },
      {
        onSuccess: () => toast.success("Lançamento marcado como pago."),
        onError: (error) =>
          toast.error(getErrorMessage(error, "Não foi possível atualizar o lançamento.")),
      },
    );
  };

  const removeTransaction = (tx: FinancialTransaction) => {
    deleteTransaction.mutate(tx.id, {
      onSuccess: () => toast.success("Lançamento excluído."),
      onError: (error) =>
        toast.error(getErrorMessage(error, "Não foi possível excluir o lançamento.")),
    });
  };

  // Form states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"receita" | "despesa">("receita");
  const [category, setCategory] = useState<
    "mensalidade" | "aula_avulsa" | "pacote" | "equipamento" | "outros"
  >("mensalidade");
  const [paymentMethod, setPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao" | "transferencia"
  >("pix");
  const [studentId, setStudentId] = useState("");
  const [dueDate, setDueDate] = useState(() => getDefaultDueDate(getCurrentMonth()));

  const openTransactionModal = () => {
    setDueDate(getDefaultDueDate(month));
    setOpenModal(true);
  };

  // Calculations
  const totalReceitaRecebida = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalReceitaPendente = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "receita" && t.status === "pendente")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAtrasado = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "receita" && t.status === "atrasado")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalDespesas = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "despesa")
    .reduce((acc, t) => acc + t.amount, 0);

  const filteredTransactions = (transactions as FinancialTransaction[]).filter((t) => {
    if (filterStatus === "todos") return true;
    return t.status === filterStatus;
  });

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    const toastId = toast.loading("Salvando lançamento...");
    const selectedStudent = students.find((student) => student.id === studentId);

    addTransaction.mutate(
      {
        description,
        amount: parseFloat(amount),
        type,
        category,
        payment_method: paymentMethod,
        student_id: selectedStudent?.id ?? null,
        student_name: selectedStudent?.name ?? null,
        competence_date: `${month}-01`,
        due_date: dueDate || getDefaultDueDate(month),
        status: "pendente",
      },
      {
        onSuccess: () => {
          toast.success("Lançamento adicionado com sucesso!", { id: toastId });
          setOpenModal(false);
          setDescription("");
          setAmount("");
          setStudentId("");
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "Não foi possível adicionar o lançamento."), {
            id: toastId,
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Financeiro"
        description="Controle de mensalidades, faturamento, despesas e pendências."
        actions={
          <>
            <div className="flex items-center rounded-md border border-border bg-background">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-r-none"
                aria-label="Mês anterior"
                title="Mês anterior"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-36 px-2 text-center text-sm font-medium capitalize">
                {formatMonth(month)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-l-none"
                aria-label="Próximo mês"
                title="Próximo mês"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={month === getCurrentMonth()}
              onClick={() => setMonth(getCurrentMonth())}
            >
              Hoje
            </Button>
            <Button size="sm" onClick={openTransactionModal}>
              <Plus className="h-4 w-4" /> Novo Lançamento
            </Button>
          </>
        }
      />

      {legacyTransactions.length > 0 && (
        <section className="panel flex flex-col gap-3 border-primary/25 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Lançamentos antigos encontrados</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Importe {legacyTransactions.length} registro
              {legacyTransactions.length === 1 ? "" : "s"} salvo
              {legacyTransactions.length === 1 ? "" : "s"} neste dispositivo para o Supabase.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={importingLegacy}
            onClick={importLegacyTransactions}
          >
            {importingLegacy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            Importar
          </Button>
        </section>
      )}

      {/* Cards Financeiros */}
      <section className="stagger grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita Recebida"
          value={formatMoney(totalReceitaRecebida)}
          icon={ArrowUpRight}
          tone="success"
        />
        <StatCard
          label="Receita A Receber"
          value={formatMoney(totalReceitaPendente)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Em Atraso"
          value={formatMoney(totalAtrasado)}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Despesas Totais"
          value={formatMoney(totalDespesas)}
          icon={ArrowDownRight}
          tone="muted"
        />
      </section>

      {/* Tabela de Lançamentos */}
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Extrato de Lançamentos</h2>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "pago", "pendente", "atrasado"] as const).map((st) => (
              <FilterPill
                key={st}
                label={st}
                active={filterStatus === st}
                onClick={() => setFilterStatus(st)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          {filteredTransactions.length === 0 ? (
            <EmptyState
              illustration="check"
              title="Nenhum lançamento encontrado"
              description="Ajuste os filtros ou adicione um novo lançamento."
              className="py-8"
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {filteredTransactions.map((tx) => (
                  <article
                    key={tx.id}
                    className="rounded-xl border border-border bg-background/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold">{tx.description}</h3>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {tx.student_name || "Sem aluno vinculado"}
                        </p>
                      </div>
                      <StatusBadge value={tx.status} label={tx.status} />
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-x-3 gap-y-3 text-xs min-[360px]:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Vencimento</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {new Date(tx.due_date).toLocaleDateString("pt-BR")}
                        </dd>
                      </div>
                      <div className="min-[360px]:text-right">
                        <dt className="text-muted-foreground">Valor</dt>
                        <dd
                          className={`mt-1 font-semibold tabular-nums ${
                            tx.type === "receita"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500"
                          }`}
                        >
                          {tx.type === "receita" ? "+" : "-"} {formatMoney(tx.amount)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 min-[360px]:flex-row">
                      {tx.status !== "pago" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="press flex-1 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                          disabled={updateTransaction.isPending}
                          onClick={() => markAsPaid(tx)}
                        >
                          <Check className="h-4 w-4" /> Marcar pago
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="press flex-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                        disabled={deleteTransaction.isPending}
                        onClick={() => removeTransaction(tx)}
                      >
                        {deleteTransaction.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Excluir
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2.5 pr-3 font-semibold">Descrição</th>
                      <th className="pb-2.5 pr-3 font-semibold">Aluno / Origem</th>
                      <th className="pb-2.5 pr-3 font-semibold">Categoria</th>
                      <th className="pb-2.5 pr-3 font-semibold">Vencimento</th>
                      <th className="pb-2.5 pr-3 font-semibold">Valor</th>
                      <th className="pb-2.5 font-semibold">Status</th>
                      <th className="pb-2.5 pl-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="transition-colors hover:bg-accent/40">
                        <td className="py-3 pr-3 font-medium">{tx.description}</td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {tx.student_name || "—"}
                        </td>
                        <td className="py-3 pr-3 text-xs capitalize">
                          {tx.category.replace("_", " ")}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground tabular-nums">
                          {new Date(tx.due_date).toLocaleDateString("pt-BR")}
                        </td>
                        <td
                          className={`py-3 pr-3 font-semibold tabular-nums ${
                            tx.type === "receita"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500"
                          }`}
                        >
                          {tx.type === "receita" ? "+" : "-"} {formatMoney(tx.amount)}
                        </td>
                        <td className="py-3">
                          <StatusBadge value={tx.status} label={tx.status} />
                        </td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {tx.status !== "pago" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="press h-8 w-8 rounded-md text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                                title="Marcar como pago"
                                aria-label="Marcar como pago"
                                disabled={updateTransaction.isPending}
                                onClick={() => markAsPaid(tx)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="press h-8 w-8 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                              title="Excluir lançamento"
                              aria-label="Excluir lançamento"
                              disabled={deleteTransaction.isPending}
                              onClick={() => removeTransaction(tx)}
                            >
                              {deleteTransaction.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Novo Lançamento */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTransaction} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tipo de Registro</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={type === "receita" ? "default" : "outline"}
                  onClick={() => setType("receita")}
                  className="w-full"
                >
                  Receita (+)
                </Button>
                <Button
                  type="button"
                  variant={type === "despesa" ? "default" : "outline"}
                  onClick={() => setType("despesa")}
                  className="w-full"
                >
                  Despesa (-)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                placeholder="Ex: Mensalidade de Violão"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="val">Valor (R$)</Label>
                <Input
                  id="val"
                  type="number"
                  step="0.01"
                  placeholder="300.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venc">Vencimento</Label>
                <Input
                  id="venc"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="st">Aluno (Opcional)</Label>
              <select
                id="st"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nenhum / Cliente Geral</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.instrument})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat">Categoria</Label>
                <select
                  id="cat"
                  value={category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setCategory(e.target.value as typeof category)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="mensalidade">Mensalidade</option>
                  <option value="aula_avulsa">Aula Avulsa</option>
                  <option value="pacote">Pacote</option>
                  <option value="equipamento">Equipamento</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pag">Forma de Pagamento</Label>
                <select
                  id="pag"
                  value={paymentMethod}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setPaymentMethod(e.target.value as typeof paymentMethod)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="pix">PIX</option>
                  <option value="cartao">Cartão de Crédito/Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={addTransaction.isPending}>
              {addTransaction.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Lançamento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year!, monthNumber! - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year!, monthNumber! - 1, 1),
  );
}

function getDefaultDueDate(month: string) {
  const now = new Date();
  if (month === getCurrentMonth()) {
    return `${month}-${String(now.getDate()).padStart(2, "0")}`;
  }
  return `${month}-05`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
