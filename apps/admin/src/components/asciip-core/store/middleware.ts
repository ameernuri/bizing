import {
  addListener,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./store";
import { AppState, appActions, appSelectors } from "./appSlice";
import _ from "lodash";
import { diagramActions } from "./diagramSlice";

export function createAsciipListenerMiddleware(
  onPersistState?: (state: AppState) => void
) {
  const listenerMiddleware = createListenerMiddleware();
  const startAppListening = listenerMiddleware.startListening.withTypes<
    RootState,
    AppDispatch
  >();

  /**
   * appSlice -> diagramSlice
   * If we selected a new active diagram => load diagram into diagramSlice
   */
  startAppListening({
    predicate: (action, currentState, originalState) => {
      return (
        currentState.app.activeDiagramId !== originalState.app.activeDiagramId
      );
    },
    effect: (action, listenerApi) => {
      const activeDiagram = appSelectors.activeDiagram(listenerApi.getState());
      listenerApi.dispatch(diagramActions.loadDiagram(activeDiagram.data));
    },
  });

  /**
   * diagramSlice -> appSlice
   * Persist diagram snapshot on commit-like events (history/style/canvas),
   * not every transient drag frame.
   */
  const debouncedUpdateDiagramData = _.debounce((_action, listenerApi) => {
    const { canvasSize, shapes, styleMode, globalStyle } =
      listenerApi.getState().diagram;

    listenerApi.dispatch(
      appActions.updateDiagramData({
        canvasSize,
        shapes,
        styleMode,
        globalStyle,
      })
    );
  }, 500);

  startAppListening({
    predicate: (_action, currentState, originalState) => {
      return (
        currentState.diagram.historyIdx !== originalState.diagram.historyIdx ||
        currentState.diagram.styleMode !== originalState.diagram.styleMode ||
        currentState.diagram.globalStyle !== originalState.diagram.globalStyle ||
        currentState.diagram.canvasSize !== originalState.diagram.canvasSize
      );
    },
    effect: debouncedUpdateDiagramData,
  });

  /**
   * appSlice -> persisted state callback
   * If data is modified in appSlice => publish it to caller persistence.
   */
  const debouncedPersistState = _.debounce((state: AppState) => {
    onPersistState?.(state);
  }, 500);

  startAppListening({
    matcher: isAnyOf(
      appActions.updateDiagramData,
      appActions.createDiagram,
      appActions.setActiveDiagram,
      appActions.renameDiagram,
      appActions.deleteDiagram
    ),
    effect: (action, listenerApi) => {
      debouncedPersistState(listenerApi.getState().app);
    },
  });

  return listenerMiddleware;
}

export const addAppListener = addListener.withTypes<RootState, AppDispatch>();
