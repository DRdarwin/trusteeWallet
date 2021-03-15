/**
 * @version 0.41
 */
import store from '@app/store'
const { dispatch } = store

let CACHE_SELECTED_FEE = false

export namespace SendActionsUpdateValues {

    export const setStepOne = (data : {cryptoValue : string, addressTo : string,  addressName: string, memo : string}) => {
        dispatch({
            type: 'SET_DATA',
            ui: data
        })
    }

    export const setCommentAndFeeFromTmp = (comment : string) => {
        console.log('CACHE_SELECTED_FEE', JSON.stringify(CACHE_SELECTED_FEE))
        if (!CACHE_SELECTED_FEE) {
            dispatch({
                type: 'SET_DATA',
                ui: {
                    comment,
                }
            })
        } else {
            const ui = {
                comment,
            }
            // @ts-ignore
            if (typeof CACHE_SELECTED_FEE.amountForTx !== 'undefined' && CACHE_SELECTED_FEE.amountForTx) {
                // @ts-ignore
                ui.cryptoValue = CACHE_SELECTED_FEE.amountForTx
            }
            dispatch({
                type: 'SET_DATA',
                ui,
                fromBlockchain : {
                    selectedFee : CACHE_SELECTED_FEE
                }
            })
        }
    }


    export const setTmpSelectedFee = (selectedFee : any) => {
        CACHE_SELECTED_FEE = selectedFee
    }
}
