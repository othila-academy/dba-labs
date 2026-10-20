-- Les garde-fous de l'application, posés sur son seul rôle : postgres et les autres rôles n'en sont pas affectés.
-- Une transaction oubliée (idle in transaction) est coupée au bout d'une minute, et ses verrous tombent avec elle.
alter role app_valmorin set idle_in_transaction_session_timeout = '1min';
-- Une requête qui attend un verrou abandonne au bout de 10 s : l'application reçoit une erreur, et réessaie.
alter role app_valmorin set lock_timeout = '10s';
