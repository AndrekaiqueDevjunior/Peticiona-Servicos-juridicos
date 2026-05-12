import { useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useContactInfo } from "@/lib/contactInfo";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Informe seu nome" })
    .max(100, { message: "Nome muito longo" }),
  whatsapp: z
    .string()
    .trim()
    .min(8, { message: "Informe um WhatsApp válido" })
    .max(20, { message: "WhatsApp inválido" })
    .regex(/^[0-9()+\-\s]+$/, { message: "Use apenas números e símbolos" }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail muito longo" }),
  message: z
    .string()
    .trim()
    .min(5, { message: "Escreva uma mensagem" })
    .max(1000, { message: "Mensagem muito longa" }),
});

const ContactForm = () => {
  const { toast } = useToast();
  const { email: targetEmail } = useContactInfo();
  const [values, setValues] = useState({ name: "", whatsapp: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof typeof values) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    // Contato direto via e-mail: abre o cliente de e-mail do usuário
    // pré-preenchido para o endereço de contato configurado pelo admin.
    const subject = encodeURIComponent(`Contato pela landing — ${values.name}`);
    const body = encodeURIComponent(
      `Nome: ${values.name}\nWhatsApp: ${values.whatsapp}\nE-mail: ${values.email}\n\nMensagem:\n${values.message}`,
    );
    const mailto = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    setTimeout(() => {
      window.location.href = mailto;
      toast({
        title: "Mensagem enviada com sucesso",
        description: `Encaminhada para ${targetEmail}. Em breve nossa equipe entrará em contato.`,
      });
      setValues({ name: "", whatsapp: "", email: "", message: "" });
      setSubmitting(false);
    }, 400);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
      <div>
        <Input
          aria-label="Nome"
          placeholder="Seu nome"
          value={values.name}
          onChange={handleChange("name")}
          maxLength={100}
          className="border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground placeholder:text-primary-foreground/50"
        />
        {errors.name && <p className="mt-1 text-xs text-accent">{errors.name}</p>}
      </div>
      <div>
        <Input
          aria-label="WhatsApp"
          placeholder="WhatsApp"
          value={values.whatsapp}
          onChange={handleChange("whatsapp")}
          maxLength={20}
          inputMode="tel"
          className="border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground placeholder:text-primary-foreground/50"
        />
        {errors.whatsapp && <p className="mt-1 text-xs text-accent">{errors.whatsapp}</p>}
      </div>
      <div>
        <Input
          aria-label="E-mail"
          type="email"
          placeholder="E-mail"
          value={values.email}
          onChange={handleChange("email")}
          maxLength={255}
          className="border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground placeholder:text-primary-foreground/50"
        />
        {errors.email && <p className="mt-1 text-xs text-accent">{errors.email}</p>}
      </div>
      <div>
        <Textarea
          aria-label="Mensagem"
          placeholder="Como podemos ajudar?"
          value={values.message}
          onChange={handleChange("message")}
          maxLength={1000}
          rows={4}
          className="border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground placeholder:text-primary-foreground/50"
        />
        {errors.message && <p className="mt-1 text-xs text-accent">{errors.message}</p>}
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {submitting ? "Enviando..." : "Enviar mensagem"}
      </Button>
    </form>
  );
};

export default ContactForm;
