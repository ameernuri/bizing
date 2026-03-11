import { StateFromReducersMapObject, configureStore } from "@reduxjs/toolkit";
import { diagramReducer, initDiagramState } from "./diagramSlice";
import { AppState, initAppState } from "./appSlice";
import { appReducer } from "./appSlice";
import { createAsciipListenerMiddleware } from "./middleware";
import { createLogger } from "redux-logger";

const reducer = {
  app: appReducer,
  diagram: diagramReducer,
};

export type RootState = StateFromReducersMapObject<typeof reducer>;

function buildPreloadedState(initialAppState?: AppState): RootState {
  const app = initialAppState ?? initAppState();
  const activeDiagramData = app.diagrams.find(
    (d) => d.id === app.activeDiagramId
  )?.data;
  return {
    app,
    diagram: initDiagramState(activeDiagramData),
  } as RootState;
}

export function createAsciipStore(options?: {
  initialAppState?: AppState;
  onPersistState?: (state: AppState) => void;
}) {
  const listenerMiddleware = createAsciipListenerMiddleware(
    options?.onPersistState
  );

  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) => {
      const mdws = [listenerMiddleware.middleware];
      if (process.env.NODE_ENV === "development") {
        mdws.push(
          createLogger({
            predicate: (getState, action) =>
              action.type !== "diagram/onCellHover",
          })
        );
      }
      return getDefaultMiddleware().prepend(...mdws);
    },
    preloadedState: buildPreloadedState(options?.initialAppState),
    devTools: { maxAge: 1000 },
  });

  return store;
}

export type AsciipStore = ReturnType<typeof createAsciipStore>;
export type AppDispatch = AsciipStore["dispatch"];
