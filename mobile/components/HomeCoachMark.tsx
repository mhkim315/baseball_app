import CoachMark from "./CoachMark";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function HomeCoachMark({ visible, onDismiss }: Props) {
  return (
    <CoachMark
      visible={visible}
      showChevrons={false}
      text="좌우로 스와이프하여 날짜를 이동하세요"
      onDismiss={onDismiss}
    />
  );
}
