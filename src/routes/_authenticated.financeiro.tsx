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
import { useAddFinancialTransaction, useFinancialTransactions, useStudents } from "@/hooks/useMusicData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · MusicCRM" },
      { name: "description", content: "Gestão financeira, mensalidades, fluxo de caixa e inadimplência." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { data: transactions = [], isLoading } = useFinancialTransactions();
  const { data: students = [] } = useStudents();
  const addTransaction = useAddFinancialTransaction();

  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">("todos");
  const [openModal, setOpenModal] = useState(false);

  // Form states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"receita" | "despesa">("receita");
  const [category, setCategory] = useState<"mensalidade" | "aula_avulsa" | "pacote" | "equipamento" | "outros">("mensalidade");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao" | "transferencia">("pix");
  const [studentName, setStudentName] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  // Calculations
  const totalReceitaRecebida = transactions
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalReceitaPendente = transactions
    .filter((t) => t.type === "receita" && t.status === "pendente")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAtrasado = transactions
    .filter((t) => t.type === "receita" && t.status === "atrasado")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalDespesas = transactions
    .filter((t) => t.type === "despesa")
    .reduce((acc, t) => acc + t.amount, 0);

  const filteredTransactions = transactions.filter((t) => {
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
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de mensalidades, faturamento, despesas e pendências.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpenModal(true)}>
          <Plus className="h-4 w-4" /> Novo Lançamento
        </Button>
      </header>

      {/* Cards Financeiros */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Receita Recebida</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              R$ {totalReceitaRecebida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Receita A Receber</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              R$ {totalReceitaPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Em Atraso / Pendente</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              R$ {totalAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Despesas Totais</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <ArrowDownRight className="h-5 w-5" />
          </span>
        </div>
      </section>

      {/* Tabela de Lançamentos */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Extrato de Lançamentos</h2>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "pago", "pendente", "atrasado"] as const).map((st) => (
              <Button
                key={st}
                variant={filterStatus === st ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(st)}
                className="capitalize text-xs"
              >
                {st}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground uppercase">
              <tr>
                <th className="pb-3 font-medium">Descrição</th>
                <th className="pb-3 font-medium">Aluno / Origem</th>
                <th className="pb-3 font-medium">Categoria</th>
                <th className="pb-3 font-medium">Vencimento</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum lançamento encontrado para esse filtro.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3.5 font-medium">{tx.description}</td>
                    <td className="py-3.5 text-muted-foreground">{tx.student_name || "—"}</td>
                    <td className="py-3.5 text-xs capitalize">{tx.category.replace("_", " ")}</td>
                    <td className="py-3.5 text-xs text-muted-foreground">
                      {new Date(tx.due_date).toLocaleDateString("pt-BR")}
                    </td>
                    <td
                      className={`py-3.5 font-semibold tabular-nums ${
                        tx.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                      }`}
                    >
                      {tx.type === "receita" ? "+" : "-"} R${" "}
                      {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5">
                      <Badge
                        variant={
                          tx.status === "pago"
                            ? "default"
                            : tx.status === "atrasado"
                            ? "destructive"
                            : "outline"
                        }
                        className="capitalize text-[11px]"
                      >
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo Lançamento */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md">
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="pix">PIX</option>
                  <option value="cartao">Cartão de Crédito/Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2">
              Salvar Lançamento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
