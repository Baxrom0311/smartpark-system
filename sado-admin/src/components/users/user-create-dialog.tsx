import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useCreateUser } from "@/hooks/queries/use-users";
import { ApiClientError } from "@/lib/api-client";
import {
  USER_LANGUAGES,
  USER_ROLES,
  createUserSchema,
  toCreateUserPayload,
  type CreateUserValues,
} from "@/lib/validation/user";
import type { UserPublic } from "@/types";

interface UserCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (user: UserPublic) => void;
}

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100";

const DEFAULTS: CreateUserValues = {
  email: "",
  phone: "",
  password: "",
  full_name: "",
  role: "parent",
  language: "uz",
  is_active: true,
};

export function UserCreateDialog({
  open,
  onClose,
  onCreated,
}: UserCreateDialogProps) {
  const { t } = useTranslation();
  const mutation = useCreateUser();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULTS,
    mode: "onSubmit",
  });

  // Reset state whenever the dialog is reopened so a closed-and-reopened
  // dialog never shows stale errors or stale field values.
  useEffect(() => {
    if (open) {
      form.reset(DEFAULTS);
      mutation.reset();
    }
  }, [open, form, mutation]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await mutation.mutateAsync(toCreateUserPayload(values));
      onCreated?.(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          form.setError("email", {
            type: "server",
            message: t("users.create.errorDuplicate"),
          });
        } else if (err.status === 422) {
          form.setError("root", {
            type: "server",
            message: t("errors.validation"),
          });
        } else {
          form.setError("root", {
            type: "server",
            message: err.message || t("errors.server"),
          });
        }
      } else if (err instanceof Error) {
        form.setError("root", { type: "server", message: err.message });
      }
    }
  });

  const submitting = form.formState.isSubmitting || mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t("users.create.title")}
      description={t("users.create.subtitle")}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="user-create-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("users.create.submit")}
          </Button>
        </>
      }
    >
      <form
        id="user-create-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        noValidate
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="user-create-name">{t("users.name")}</Label>
          <Input
            id="user-create-name"
            autoComplete="name"
            {...form.register("full_name")}
            aria-invalid={Boolean(form.formState.errors.full_name)}
          />
          {form.formState.errors.full_name?.message && (
            <p className="text-xs text-risk-red">
              {form.formState.errors.full_name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-create-email">{t("auth.email")}</Label>
          <Input
            id="user-create-email"
            type="email"
            autoComplete="email"
            {...form.register("email")}
            aria-invalid={Boolean(form.formState.errors.email)}
          />
          {form.formState.errors.email?.message && (
            <p className="text-xs text-risk-red">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-create-phone">{t("auth.phone")}</Label>
          <Input
            id="user-create-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+998901234567"
            {...form.register("phone")}
            aria-invalid={Boolean(form.formState.errors.phone)}
          />
          {form.formState.errors.phone?.message && (
            <p className="text-xs text-risk-red">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="user-create-password">{t("auth.password")}</Label>
          <Input
            id="user-create-password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
            aria-invalid={Boolean(form.formState.errors.password)}
          />
          {form.formState.errors.password?.message && (
            <p className="text-xs text-risk-red">
              {form.formState.errors.password.message}
            </p>
          )}
          <p className="text-xs text-brand-500 dark:text-brand-400">
            {t("users.create.passwordHint")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-create-role">{t("users.role")}</Label>
          <select
            id="user-create-role"
            className={SELECT_CLASS}
            {...form.register("role")}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`users.roles.${role}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-create-language">{t("settings.language")}</Label>
          <select
            id="user-create-language"
            className={SELECT_CLASS}
            {...form.register("language")}
          >
            {USER_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            {...form.register("is_active")}
          />
          <span className="text-sm text-brand-800 dark:text-brand-200">
            {t("users.create.activeOnCreate")}
          </span>
        </label>

        {form.formState.errors.root?.message && (
          <div
            role="alert"
            className="rounded-md border border-risk-red/30 bg-risk-red/10 px-3 py-2 text-sm text-risk-red sm:col-span-2"
          >
            {form.formState.errors.root.message}
          </div>
        )}
      </form>
    </Modal>
  );
}
