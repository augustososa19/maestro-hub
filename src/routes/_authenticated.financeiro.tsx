import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Receipt,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddFinancialTransaction,
  useFinancialTransactions,
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
  const { data: transactions = [] } = useFinancialTransactions();
  const { data: students = [] } = useStudents();
  const addTransaction = useAddFinancialTransaction();

  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">(
    "todos",
  );
  const [openModal, setOpenModal] = useState(false);

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
  const [studentName, setStudentName] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

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

    addTransaction.mutate({
      description,
      amount: parseFloat(amount),
      type,
      category,
      payment_method: paymentMethod,
      student_name: studentName || undefined,
      due_date: dueDate || new Date().toISOString().split("T")[0],
      status: "pendente",
    });

    toast.success("Lançamento adicionado com sucesso!");
    setOpenModal(false);
    setDescription("");
    setAmount("");
    setStudentName("");
  };

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Financeiro"
        description="Controle de mensalidades, faturamento, despesas e pendências."
        actions={
          <Button size="sm" onClick={() => setOpenModal(true)}>
            <Plus className="h-4 w-4" /> Novo Lançamento
          </Button>
        }
      />

      {/* Cards Financeiros */}
      <section className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
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

        <div className="mt-4 overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <EmptyState
              illustration="check"
              title="Nenhum lançamento encontrado"
              description="Ajuste os filtros ou adicione um novo lançamento."
              className="py-8"
            />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2.5 pr-3 font-semibold">Descrição</th>
                  <th className="pb-2.5 pr-3 font-semibold">Aluno / Origem</th>
                  <th className="pb-2.5 pr-3 font-semibold">Categoria</th>
                  <th className="pb-2.5 pr-3 font-semibold">Vencimento</th>
                  <th className="pb-2.5 pr-3 font-semibold">Valor</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="transition-colors hover:bg-accent/40">
                    <td className="py-3 pr-3 font-medium">{tx.description}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{tx.student_name || "—"}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div className="grid grid-cols-2 gap-2">
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

            <div className="grid grid-cols-2 gap-3">
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
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nenhum / Cliente Geral</option>
                {students.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.instrument})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <Button type="submit" className="w-full">
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
