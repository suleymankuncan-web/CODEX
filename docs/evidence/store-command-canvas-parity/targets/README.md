# Targets Command Canvas parity evidence

This directory records the production `/store/targets` Region Manager and
Report Viewer cutover evidence for PR 5 of the approved seven-PR plan.

The automated evidence suite verifies the real Store shell, Command Canvas
frame, role-specific hierarchy, clickable rows without an action column,
pagination, read-only Report Viewer drawer, editable Region Manager drawer,
320 px overflow safety and absence of the former Targets owner selectors.

The screenshots are deterministic fixture evidence, not live-data proof.
Semantic, interaction and viewport parity are automated. The accepted drawer
geometry is mechanically locked to the prototype contract: 460 px desktop
width and a two-by-two metric grid; the title and metric copy are asserted in
the route contracts. Real-persona controlled-pilot evidence remains part of
the final PR 7 closeout.
