'use strict';


LIV.openDb =
  function () {

    return new Promise(
      (resolve, reject) => {

        const request =
          indexedDB.open(
            LIV.DB_NAME,
            LIV.DB_VERSION
          );


        request.onupgradeneeded =
          event => {

            const database =
              event.target.result;

            if (
              !database
                .objectStoreNames
                .contains(
                  LIV.STORE
                )
            ) {
              database
                .createObjectStore(
                  LIV.STORE
                );
            }
          };


        request.onsuccess =
          event =>
            resolve(
              event.target.result
            );


        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );
  };


LIV.dbGet =
  function (
    key = LIV.PROJECT_KEY
  ) {

    return new Promise(
      (resolve, reject) => {

        const transaction =
          LIV.db.transaction(
            LIV.STORE,
            'readonly'
          );

        const request =
          transaction
            .objectStore(
              LIV.STORE
            )
            .get(key);

        request.onsuccess =
          () =>
            resolve(
              request.result ||
              null
            );

        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );
  };


LIV.dbPut =
  function (
    value,
    key = LIV.PROJECT_KEY
  ) {

    return new Promise(
      (resolve, reject) => {

        const transaction =
          LIV.db.transaction(
            LIV.STORE,
            'readwrite'
          );

        transaction
          .objectStore(
            LIV.STORE
          )
          .put(
            value,
            key
          );

        transaction.oncomplete =
          () =>
            resolve();

        transaction.onerror =
          () =>
            reject(
              transaction.error
            );
      }
    );
  };


LIV.saveProject =
  async function () {

    LIV.project.meta.updatedAt =
      LIV.nowIso();

    LIV.project.schemaVersion =
      LIV.SCHEMA_VERSION;

    await LIV.dbPut(
      LIV.project
    );
  };


LIV.loadProject =
  async function () {

    LIV.db =
      await LIV.openDb();

    const raw =
      await LIV.dbGet();

    if (!raw) {
      LIV.project =
        LIV.emptyProject();

      await LIV.saveProject();

      return;
    }

    if (
      raw.schemaVersion !==
      LIV.SCHEMA_VERSION
    ) {
      await LIV.dbPut(
        LIV.clone(raw),
        `migration-backup-${Date.now()}`
      );
    }

    LIV.project =
      LIV.normalizeProject(raw);

    await LIV.saveProject();
  };
