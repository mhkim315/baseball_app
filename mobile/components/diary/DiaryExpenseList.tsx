import { View, Text, Pressable } from "react-native";
import { EXPENSE_CATEGORIES } from "@/lib/db";
import type { ExpenseCategory } from "@/lib/db";
import ExpenseForm from "@/components/ExpenseForm";

export default function DiaryExpenseList({ pendingExpenses, setPendingExpenses, showExpenseInput, setShowExpenseInput, newExpenseCat, setNewExpenseCat, newExpenseAmt, setNewExpenseAmt, newExpenseMemo, setNewExpenseMemo, setSimpleAlert, styles }: {
  pendingExpenses: { category: ExpenseCategory; amount: string; memo: string }[];
  setPendingExpenses: React.Dispatch<React.SetStateAction<{ category: ExpenseCategory; amount: string; memo: string }[]>>;
  showExpenseInput: boolean;
  setShowExpenseInput: React.Dispatch<React.SetStateAction<boolean>>;
  newExpenseCat: ExpenseCategory;
  setNewExpenseCat: React.Dispatch<React.SetStateAction<ExpenseCategory>>;
  newExpenseAmt: string;
  setNewExpenseAmt: React.Dispatch<React.SetStateAction<string>>;
  newExpenseMemo: string;
  setNewExpenseMemo: React.Dispatch<React.SetStateAction<string>>;
  setSimpleAlert: React.Dispatch<React.SetStateAction<{ visible: boolean; title: string; message: string; onOk?: () => void }>>;
  styles: Record<string, any>;
}) {
  return (
    <View>
      <View style={styles.expenseSectionHeader}>
        <Text style={styles.sectionTitle}>지출 기록</Text>
        {pendingExpenses.length > 0 && (
          <Text style={styles.expenseTotal}>
            ({pendingExpenses.length}건 · {pendingExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}원)
          </Text>
        )}
      </View>

      {pendingExpenses.map((exp, idx) => (
        <View key={idx} style={styles.expenseCard}>
          <View style={styles.expenseCardMain}>
            <Text style={styles.expenseCardIcon}>{EXPENSE_CATEGORIES[exp.category]?.icon || "💸"}</Text>
            <Text style={styles.expenseCardLabel}>{EXPENSE_CATEGORIES[exp.category]?.label || exp.category}</Text>
            <Text style={styles.expenseCardAmount}>{Number(exp.amount).toLocaleString()}원</Text>
            <Pressable onPress={() => setPendingExpenses((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
              <Text style={styles.expenseCardRemove}>✕</Text>
            </Pressable>
          </View>
          {exp.memo ? <Text style={styles.expenseCardMemo}>{exp.memo}</Text> : null}
        </View>
      ))}

      {showExpenseInput ? (
        <ExpenseForm
          category={newExpenseCat}
          onCategoryChange={setNewExpenseCat}
          amount={newExpenseAmt}
          onAmountChange={setNewExpenseAmt}
          memo={newExpenseMemo}
          onMemoChange={setNewExpenseMemo}
          onSave={() => {
            const amt = parseInt(newExpenseAmt.replace(/,/g, ""));
            if (!amt || amt <= 0) {
              setSimpleAlert({ visible: true, title: "알림", message: "올바른 금액을 입력해주세요" });
              return;
            }
            setPendingExpenses((prev) => [...prev, { category: newExpenseCat, amount: String(amt), memo: newExpenseMemo }]);
            setNewExpenseAmt("");
            setNewExpenseMemo("");
            setShowExpenseInput(false);
          }}
          onCancel={() => {
            setNewExpenseAmt("");
            setNewExpenseMemo("");
            setShowExpenseInput(false);
          }}
          saveLabel="추가"
          cancelLabel="취소"
          autoFocusAmount
        />
      ) : (
        <Pressable style={styles.expenseAddLink} onPress={() => setShowExpenseInput(true)}>
          <Text style={styles.expenseAddLinkText}>＋ 지출 추가</Text>
        </Pressable>
      )}
    </View>
  );
}
