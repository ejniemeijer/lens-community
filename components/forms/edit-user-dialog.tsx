"use client";

import * as React from "react";
import type { User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function EditUserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
}) {
  const updateUser = useApp((s) => s.updateUser);
  const toast = useApp((s) => s.toast);
  const [name, setName] = React.useState(user.name);
  const [email, setEmail] = React.useState(user.email);
  const [jobTitle, setJobTitle] = React.useState(user.jobTitle);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email);
      setJobTitle(user.jobTitle);
      setError("");
    }
  }, [open, user]);

  const save = () => {
    if (!name.trim()) return setError("Name is required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("A valid email is required.");
    updateUser(user.id, { name: name.trim(), email: email.trim(), jobTitle: jobTitle.trim() });
    toast(`${name.trim()} updated`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${user.name}`}
      description="Account details for this workspace."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Job title</Label>
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
