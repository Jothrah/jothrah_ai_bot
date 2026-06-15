"use client";

import { useRef } from "react";

type ReplyFormProps = {
  conversationId: string;
  action: (formData: FormData) => Promise<void>;
  styles: {
    replyForm: React.CSSProperties;
    replyTextarea: React.CSSProperties;
    replyButton: React.CSSProperties;
  };
};

export default function ReplyForm({
  conversationId,
  action,
  styles
}: ReplyFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} style={styles.replyForm}>
      <input type="hidden" name="conversation_id" value={conversationId} />

      <textarea
        name="message"
        placeholder="اكتب ردك للعميل هنا..."
        style={styles.replyTextarea}
        required
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />

      <button type="submit" style={styles.replyButton}>
        إرسال الرد
      </button>
    </form>
  );
}