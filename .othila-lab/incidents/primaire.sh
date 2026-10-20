# shellcheck shell=bash
# L'incident du lab replica-set, joué par scripts/db incident primaire : le nœud primaire de rs0 s'arrête (docker compose
# stop). Rien d'autre ne bouge ; rejoué alors qu'un nœud est déjà arrêté, il n'en arrête pas un second.
[[ ",${COMPOSE_PROFILES:-}," == *",rs,"* ]] \
  || die "rs0 n'a qu'un nœud : ajoute rs à project/stack.env, puis scripts/db up (lab replica-set)"
rs_eval() { mongosh --quiet "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&serverSelectionTimeoutMS=5000" --eval "$1"; }
membres="$(rs_eval 'rs.status().members.length')" || die "rs0 ne répond pas : scripts/db status"
[[ $membres -ge 3 ]] || die "rs0 a $membres membre(s) : project/mongo/010_replica.js doit ajouter mongo2 et mongo3 (puis scripts/db rebuild)"
# L'état des conteneurs, et non les battements de cœur de rs0 : juste après un arrêt, les autres nœuds le croient encore là.
arretes="$(comm -23 <(printf '%s\n' mongo1 mongo2 mongo3) <(compose ps --services --status running | sort) | paste -sd' ' -)"
if [[ -n $arretes ]]; then
  info "un nœud est déjà arrêté ($arretes) : rien de plus. scripts/db up le relance."
else
  primaire="$(rs_eval 'db.hello().primary')"
  noeud="${primaire%%:*}"
  compose stop "$noeud" >/dev/null 2>&1 || die "impossible d'arrêter $noeud : scripts/db status"
  info ""
  info "02:14 — La supervision alerte : $noeud, le nœud primaire de rs0, ne répond plus (serveur arrêté)."
  info "02:15 — Les lecteurs déposent-ils encore leurs avis en ligne ? Personne ne le sait."
  info "02:16 — À toi : observe rs0 par la chaîne de l'application (project/app.env, les trois hôtes), écris pendant la panne,"
  info "        puis relance le nœud (scripts/db up) et regarde-le revenir."
fi
