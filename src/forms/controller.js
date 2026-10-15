function buildFormLab() {
  if (formLabReady) return;
  formLabReady = true;
  buildFormSettings();
  buildFormInputs();
  buildFormDropdowns();
  buildFormCheckboxes();
  buildFormRadios();
  buildFormSwitches();
  applyFormAppearance();
  buildWorkspaceLab();
}
function closeFormDropdowns() {
  for (const dropdown of formDropdowns) dropdown.close();
}
