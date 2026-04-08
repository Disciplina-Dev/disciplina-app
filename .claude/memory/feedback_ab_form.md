---
name: Corrections AB entreprise
description: Corrections sur le process de remplissage de l'AB et les fonctionnalités à ne pas implémenter
type: feedback
---

L'AB est rempli par l'entreprise elle-même via la page web publique — pas par le commercial Disciplina.

**Why:** Le commercial n'intervient pas dans la saisie. C'est l'entreprise qui fait la démarche en autonomie.

**How to apply:** Ne pas prévoir d'interface intranet pour la saisie de l'AB côté commercial. Le formulaire AB est uniquement une page publique côté entreprise.

---

Pas de fonctionnalité brouillon (draft) sur l'AB pour l'instant.

**Why:** Jugée inutile à ce stade du projet.

**How to apply:** Ne pas implémenter de sauvegarde de brouillon ni de logique de session persistante sur le formulaire AB.

---

Pas de relance automatique si AB non signé.

**Why:** Inutile puisque c'est l'entreprise qui fait la démarche elle-même — elle n'a pas besoin d'être relancée.

**How to apply:** Ne pas prévoir de workflow de relance YouSign pour le formulaire AB entreprise.
