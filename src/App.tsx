import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { produce } from 'immer'
import { randomID, sortBy } from './util'
import { api } from './api'
import { Header as _Header } from './Header'
import { Column } from './Column'
import { DeleteDialog } from './DeleteDialog'
import { Overlay as _Overlay } from './Overlay'

type State = {
  columns?: {
    id: string
    title?: string
    text?: string
    cards?: {
      id: string
      text?: string
    }[]
  }[]
  cardsOrder: Record<string, string>
}

export function App() {
  const [filterValue, setFilterValue] = useState('')
  const [{ columns }, setData] = useState<State>({ cardsOrder: {} })

  useEffect(() => {
    ;(async () => {
      const columns = await api('GET /v1/columns', null)

      setData(
        produce((draft: State) => {
          draft.columns = columns
        }),
      )

      const [unorderedCards, cardsOrder] = await Promise.all([
        api('GET /v1/cards', null),
        api('GET /v1/cardsOrder', null),
      ])

      setData(
        produce((draft: State) => {
          draft.cardsOrder = cardsOrder
          draft.columns?.forEach(column => {
            column.cards = sortBy(unorderedCards, cardsOrder, column.id)
          })
        }),
      )
    })()
  }, [])

  const [draggingCardID, setDraggingCardID] = useState<string | undefined>(
    undefined,
  )

  const dropCardTo = (toID: string) => {
    const fromID = draggingCardID
    if (!fromID) return

    setDraggingCardID(undefined)

    if (fromID === toID) return

    setData(
      produce((draft: State) => {
        const card = draft.columns
          ?.flatMap(col => col.cards ?? [])
          .find(c => c.id === fromID)
        if (!card) return

        const fromColumn = draft.columns?.find(col =>
          col.cards?.some(c => c.id === fromID),
        )
        if (!fromColumn?.cards) return

        fromColumn.cards = fromColumn.cards.filter(c => c.id !== fromID)

        const toColumn = draft.columns?.find(
          col => col.id === toID || col.cards?.some(c => c.id === toID),
        )
        if (!toColumn?.cards) return

        let index = toColumn.cards.findIndex(c => c.id === toID)
        if (index < 0) {
          index = toColumn.cards.length
        }
        toColumn.cards.splice(index, 0, card)
      }),
    )
  }

  const setText = (columnID: string, value: string) => {
    setData(
      produce((draft: State) => {
        const column = draft.columns?.find(c => c.id === columnID)
        if (!column) return

        column.text = value
      }),
    )
  }

  const addCard = (columnID: string) => {
    const column = columns?.find(c => c.id === columnID)
    if (!column) return

    const text = column.text
    const cardID = randomID()

    setData(
      produce((draft: State) => {
        const column = draft.columns?.find(c => c.id === columnID)
        if (!column) return

        column.cards?.unshift({
          id: cardID,
          text: column.text,
        })
        column.text = ''
      }),
    )

    api('POST /v1/cards', {
      id: cardID,
      text,
    })
  }

  const [deletingCardID, setDeletingCardID] = useState<string | undefined>(
    undefined,
  )

  const deleteCard = () => {
    const cardID = deletingCardID
    if (!cardID) return

    setDeletingCardID(undefined)

    setData(
      produce((draft: State) => {
        const column = draft.columns?.find(col =>
          col.cards?.some(c => c.id === cardID),
        )
        if (!column) return

        column.cards = column.cards?.filter(c => c.id !== cardID)
      }),
    )
  }

  return (
    <Container>
      <Header filterValue={filterValue} onFilterChange={setFilterValue} />

      <MainArea>
        <HorizontalScroll>
          {!columns ? (
            <Loading />
          ) : (
            columns.map(({ id: columnID, title, cards, text }) => (
              <Column
                key={columnID}
                title={title}
                filterValue={filterValue}
                cards={cards}
                onCardDragStart={cardID => setDraggingCardID(cardID)}
                onCardDrop={entered => dropCardTo(entered ?? columnID)}
                onCardDeleteClick={cardID => setDeletingCardID(cardID)}
                text={text}
                onTextChange={value => setText(columnID, value)}
                onTextConfirm={() => addCard(columnID)}
              />
            ))
          )}
        </HorizontalScroll>
      </MainArea>

      {deletingCardID && (
        <Overlay onClick={() => setDeletingCardID(undefined)}>
          <DeleteDialog
            onConfirm={deleteCard}
            onCancel={() => setDeletingCardID(undefined)}
          />
        </Overlay>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-flow: column;
  height: 100%;
`

const Header = styled(_Header)`
  flex-shrink: 0;
`

const MainArea = styled.div`
  height: 100%;
  padding: 16px 0;
  overflow-y: auto;
`

const HorizontalScroll = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  overflow-x: auto;

  > * {
    margin-left: 16px;
    flex-shrink: 0;
  }

  ::after {
    display: block;
    flex: 0 0 16px;
    content: '';
  }
`

const Loading = styled.div.attrs({
  children: 'Loading...',
})`
  font-size: 14px;
`

const Overlay = styled(_Overlay)`
  display: flex;
  justify-content: center;
  align-items: center;
`
