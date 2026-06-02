# React Web field-array dogfood priority evidence

Local diagnostic dogfood evidence only: checks whether React Web fact graph consumer dry-run exposes useFieldArray patch-target and dynamic-fields role coverage. It is not task-success evidence, not runtime authorization, not token/cost/billing proof, and not a claim that priority promotion improves model edits.

## Fixture

- Fixture: `test/fixtures/react-web-context-expansion/field-array-contacts-form.tsx`
- Contains useFieldArray: yes
- Contains fields.map: yes
- Contains append/remove: yes

## Default consumer budget

- maxAnchors: 8
- selected/deferred: 8/67
- useFieldArray patch-target selected: yes
- dynamic-fields role selected: no
- dynamic-fields role coverage: deferred; selected=0; deferred=1; reasons=budget-deferred

## Wide inspection budget

- maxAnchors: 20
- selected/deferred: 20/55
- useFieldArray patch-target selected: yes
- dynamic-fields role selected: no
- dynamic-fields role coverage: deferred; selected=0; deferred=1; reasons=budget-deferred

## Priority decision

- Verdict: defer-promotion-pending-task-outcome
- Reason: useFieldArray patch-target evidence is selected, while dynamic-fields role remains budget-deferred even in the inspected wide budget; this is a measurement signal, not proof that priority promotion improves edits
- Next action: run task-outcome dogfood before promoting dynamic-fields priority

## Selected anchors sample

- #1 patch-target:validation-anchor: useFieldArray (priority=110)
- #2 targets: FieldArrayContactsForm targets FieldArrayContactsForm (priority=100)
- #3 targets: FieldArrayContactsForm targets FieldArrayContactsForm (priority=100)
- #4 patch-target:component: FieldArrayContactsForm (priority=100)
- #5 targets: FieldArrayContactsForm targets useForm (priority=100)
- #6 targets: FieldArrayContactsForm targets useForm (priority=100)
- #7 patch-target:validation-anchor: useForm (priority=100)
- #8 targets: FieldArrayContactsForm targets defaultValues (priority=100)

## Deferred form-state role anchors under wide budget

- #47 form-state-role:validation-defaults: defaultValues; reason=budget-deferred
- #48 form-state-role:submit-flow: handleSubmit(() => undefined), form onSubmit=handleSubmit(() => undefined); reason=budget-deferred
- #49 form-state-role:field-registration: register, form, input; reason=budget-deferred
- #50 form-state-role:dynamic-fields: useFieldArray; reason=budget-deferred
- #51 form-state-role:form-root: useForm; reason=budget-deferred

## Boundary

This artifact decides whether priority promotion is justified by consumer visibility evidence only. It does not prove model edit success.
