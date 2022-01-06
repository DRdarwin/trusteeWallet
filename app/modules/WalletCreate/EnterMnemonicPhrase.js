/**
 * @version 0.9
 */
import React, { PureComponent } from 'react'
import { connect } from 'react-redux'
import _debounce from 'lodash/debounce'
import { Keyboard, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'

import IconMaterial from 'react-native-vector-icons/MaterialIcons'


import NavStore from '@app/components/navigation/NavStore'

import App from '@app/appstores/Actions/App/App'
import { showModal } from '@app/appstores/Stores/Modal/ModalActions'
import { setCallback, setWalletMnemonic, proceedSaveGeneratedWallet } from '@app/appstores/Stores/CreateWallet/CreateWalletActions'
import { setLoaderStatus } from '@app/appstores/Stores/Main/MainStoreActions'

import walletDS from '@app/appstores/DataSource/Wallet/Wallet'

import { strings } from '@app/services/i18n'

import Log from '@app/services/Log/Log'
import UpdateOneByOneDaemon from '@app/daemons/back/UpdateOneByOneDaemon'
import UpdateAccountListDaemon from '@app/daemons/view/UpdateAccountListDaemon'
// import GoogleDrive from '@app/services/Back/Google/GoogleDrive'

import TextInput from '@app/components/elements/new/TextInput'
import TwoButtons from '@app/components/elements/new/buttons/TwoButtons'
import CustomIcon from '@app/components/elements/CustomIcon'

import MnemonicWord from '../WalletBackup/elements/MnemonicWord'
import SelectedMnemonic from '../WalletBackup/elements/SelectedMnemonic'


import { ThemeContext } from '@app/theme/ThemeProvider'

import MNEMONIC_DICTIONARY from '@app/services/UI/Validator/_words/english.json'
import Validator from '@app/services/UI/Validator/Validator'

import MarketingAnalytics from '@app/services/Marketing/MarketingAnalytics'
import MarketingEvent from '@app/services/Marketing/MarketingEvent'
import ScreenWrapper from '@app/components/elements/ScreenWrapper'
import { checkQRPermission } from '@app/services/UI/Qr/QrPermissions'
import { QRCodeScannerFlowTypes, setQRConfig } from '@app/appstores/Stores/QRCodeScanner/QRCodeScannerActions'
import Toast from '@app/services/UI/Toast/Toast'


const callWithDelay = _debounce(
    (cb) => {
        if (typeof cb === 'function') cb();
    },
    500,
    {
        leading: false,
        trailing: true,
    }
)


class EnterMnemonicPhrase extends PureComponent {

    constructor(props) {
        super(props)
        this.state = {
            walletExist: false,
            googleMnemonic: false,
            isMnemonicVisible: false,
            walletMnemonicSelected: [],
            wordsProposed: [],
            error: null,
            phraseInputValue: '',
            flowSubtype: '',
        }
    }

    componentDidMount() {
        const flowSubtype = NavStore.getParamWrapper(this, 'flowSubtype', 'createFirst')
        this.setState(() => ({ flowSubtype }))
    }

    // init() {
    //     const data = this.props.navigation.getParam('flowSubtype')

    //     if (data !== 'GOOGLE_SUBTYPE') {
    //         return false
    //     }
    //     // somehow without state change init not loaded with ref
    //     if (typeof this.mnemonicPhrase.handleInput !== 'undefined') {
    //         if (!this.state.googleMnemonic) {
    //             this.setState({ googleMnemonic: true })
    //             this.mnemonicPhrase.handleInput(GoogleDrive.currentMnemonic())
    //         }
    //     } else {
    //         this.setState({ googleMnemonic: false })
    //     }
    // }

    handleImport = async () => {
        const walletMnemonic = this.state.walletMnemonicSelected.join(' ')
        const result = await Validator.arrayValidation([{
            type: 'MNEMONIC_PHRASE',
            value: walletMnemonic
        }])

        if (result.status === 'fail') {
            const error = result.errorArr[0]?.msg
            this.setState(() => ({ error }))
            return
        }

        const { walletName, callback, source, walletNumber } = this.props.walletCreateStore

        if (result.status === 'success' && await walletDS.walletExist(walletMnemonic)) {
            this.setState(() => ({ error: strings('walletCreate.walletExist') }))
            return
        }

        setWalletMnemonic(walletMnemonic)

        try {

            MarketingEvent.logEvent('gx_view_mnemonic_import_screen_validated', { walletNumber, source }, 'GX')

            Keyboard.dismiss()

            setLoaderStatus(true)

            const walletHash = await proceedSaveGeneratedWallet({
                walletName,
                walletMnemonic,
                walletIsBackedUp: 1,
                walletNumber,
            }, 'IMPORT')

            try {
                if (walletNumber * 1 > 1) {
                    await App.refreshWalletsStore({ firstTimeCall: false, walletHash, source: 'WalletCreate.EnterMnemonicPhrase' })
                } else {
                    App.init({ source: 'WalletCreate.EnterMnemonicPhrase', onMount: false })
                }
            } catch (e) {
                e.message += ' while WalletCreate.EnterMnemonicPhrase.refreshWalletsStore'
                throw e
            }

            setLoaderStatus(false)

            MarketingEvent.logEvent('gx_view_mnemonic_import_screen_success', { walletNumber, source }, 'GX')

            showModal({
                type: 'INFO_MODAL',
                icon: true,
                title: strings('modal.walletCreate.success'),
                description: strings('modal.walletCreate.walletImported'),
                noBackdropPress: true,
            }, async () => {
                if (callback === null || !callback) {
                    if (this.state.flowSubtype === 'importAnother') {
                        NavStore.goBack()
                        NavStore.goBack()
                    } else {
                        NavStore.reset('TabBar')
                    }
                } else if (callback === 'InitScreen') {
                    setCallback({ callback: null })
                    NavStore.reset('InitScreen')
                } else {
                    callback()
                    setCallback({ callback: null })
                }
            })

        } catch (e) {
            Log.err('WalletCreate.EnterMnemonicPhrase error ' + e.message)

            setLoaderStatus(false)

            showModal({
                type: 'INFO_MODAL',
                icon: false,
                title: strings('modal.send.fail'),
                description: e.message
            })

        }

    }

    openWalletSettings = () => {
        NavStore.goNext('BackupSettingsScreen')
    }

    handleSelectWord = (word) => {
        const { source, walletNumber } = this.props.walletCreateStore
        if (!this.state.walletMnemonicSelected || this.state.walletMnemonicSelected.length === 0) {
            MarketingEvent.logEvent('gx_view_mnemonic_import_screen_first', { walletNumber, source }, 'GX')
        }
        this.setState(state => ({
            walletMnemonicSelected: [...state.walletMnemonicSelected, word],
            wordsProposed: [],
            phraseInputValue: ''
        }))
    }

    handleRemoveWord = (word) => {
        this.setState(state => ({
            walletMnemonicSelected: state.walletMnemonicSelected.filter(w => w !== word)
        }))
    }

    handleBack = () => { NavStore.goBack() }

    handleClose = () => { NavStore.reset('TabBar') }

    handleInputPhrase = (_value = '') => {
        const value = _value.trim()
        const lowercasedValue = value.toLowerCase()
        const spacesNumber = lowercasedValue.match(/\s/g)?.length || 0
        if (!lowercasedValue) {
            this.setState(() => ({
                phraseInputValue: '',
                error: null,
                wordsProposed: []
            }))
            return
        }

        if (spacesNumber === 0) {
            if (value !== _value) {
                // whitespace is entered
                this.findWords(lowercasedValue, true)
            } else {
                callWithDelay(() => this.findWords(lowercasedValue, false))
                this.setState(() => ({ phraseInputValue: value }))
            }
            return
        }

        if (spacesNumber >= 11) {
            const wordsArr = lowercasedValue.split(/\s+/g) // linebreaks could be
            const { source, walletNumber } = this.props.walletCreateStore
            MarketingEvent.logEvent('gx_view_mnemonic_import_screen_first', { walletNumber, source }, 'GX')
            this.setState(() => ({
                walletMnemonicSelected: wordsArr,
                wordsProposed: [],
                phraseInputValue: '',
                error: null
            }))
            Keyboard.dismiss()
            return
        }

        if (spacesNumber > 0) {
            this.setState(() => ({
                error: strings('walletCreate.errors.phraseShouldBeLonger'),
                wordsProposed: [],
                phraseInputValue: value
            }))
            return
        }
    }

    findWords = (value, setIfOk = false) => {
        const wordsProposed = []

        MNEMONIC_DICTIONARY.every((word) => {
            if (wordsProposed.length === 4) return false
            if (word.startsWith(value)) wordsProposed.push(word)
            return true
        })

        const error = wordsProposed.length ? null : strings('walletCreate.errors.wordDoesNotExist')
        if (wordsProposed.length === 1 && setIfOk) {
            // entering words fast enough with whitespace search
            this.handleSelectWord(wordsProposed[0])
            return false
        }

        this.setState(state => ({
            wordsProposed: state.phraseInputValue ? wordsProposed : [],
            error
        }))
    }

    triggerMnemonicVisible = () => {
        if (!this.state.walletMnemonicSelected.length) {
            this.textInput.focus()
        } else {
            this.setState(state => ({ isMnemonicVisible: !state.isMnemonicVisible }))
        }
    }

    handleOpenQr = () => {
        setQRConfig({ flowType: QRCodeScannerFlowTypes.ADD_MNEMONIC_SCANNER, callback : (data) => {
            try {
                this.handleInputPhrase(data)
            } catch (e) {
                Log.log('QRCodeScannerScreen callback error ' + e.message )
                Toast.setMessage(e.message).show()
            }
            NavStore.goBack()
        }})
        NavStore.goNext('QRCodeScannerScreen')
    }

    renderQrCode = () => {
        const { error, phraseInputValue } = this.state
        const { colors } = this.context
        const iconColor = error
            ? colors.createWalletScreen.importWallet.error
            : phraseInputValue
                ? colors.common.text2
                : colors.common.text1

        return (
            <TouchableOpacity onPress={() => checkQRPermission(this.handleOpenQr)}>
                <CustomIcon name={'qr'} size={20} color={iconColor} />
            </TouchableOpacity>
        )
    }

    render() {
        // this.init()

        UpdateOneByOneDaemon.pause()
        UpdateAccountListDaemon.pause()

        MarketingAnalytics.setCurrentScreen('WalletCreate.EnterMnemonicPhraseScreen')

        const {
            isMnemonicVisible,
            wordsProposed,
            walletMnemonicSelected,
            phraseInputValue,
            error,
            flowSubtype
        } = this.state
        const { GRID_SIZE, colors } = this.context

        return (
            <ScreenWrapper
                rightType="close"
                rightAction={flowSubtype === 'importAnother' ? this.handleClose : this.handleBack}
                leftType={flowSubtype === 'importAnother' ? 'back' : undefined}
                leftAction={flowSubtype === 'importAnother' ? this.handleBack : undefined}
                title={strings('walletCreate.importTitle')}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    ref={ref => { this.scrollView = ref }}
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ paddingHorizontal: GRID_SIZE, paddingVertical: GRID_SIZE * 2 }}>
                        <SelectedMnemonic
                            placeholder={strings('walletCreate.mnemonicPlaceholder')}
                            showButtonTitle={strings('walletCreate.showMnemonicButton')}
                            triggerMnemonicVisible={this.triggerMnemonicVisible}
                            removeWord={this.handleRemoveWord}
                            isMnemonicVisible={isMnemonicVisible}
                            data={walletMnemonicSelected}
                        />
                        <View style={{ marginTop: GRID_SIZE * 0.75 }}>
                            <TextInput
                                compRef={ref => this.textInput = ref }
                                autoCapitalize="none"
                                inputStyle={!!error && { color: colors.createWalletScreen.importWallet.error }}
                                placeholder={strings('walletCreate.phrasePlaceholder')}
                                onChangeText={this.handleInputPhrase}
                                value={phraseInputValue}
                                paste={true}
                                qr={true}
                                qrCallback={this.handleOpenQr}
                                callback={this.handleInputPhrase}
                            />
                            {!!error && (
                                <View style={[styles.errorContainer, { marginTop: GRID_SIZE / 2, marginHorizontal: GRID_SIZE }]}>
                                    <IconMaterial name="error-outline" size={22} color={colors.createWalletScreen.importWallet.error} />
                                    <Text style={[styles.errorMessage, { color: colors.common.text3 }]}>{error}</Text>
                                </View>
                            )}
                            <View style={[styles.wordsContainer, { marginTop: GRID_SIZE }]}>
                                {wordsProposed.map((word, i) => (
                                    <MnemonicWord
                                        value={word}
                                        key={`${word}${i}`}
                                        onPress={() => this.handleSelectWord(word, i)}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={{
                        paddingHorizontal: GRID_SIZE,
                        paddingVertical: GRID_SIZE * 1.5,
                    }}>
                        <TwoButtons
                            mainButton={{
                                disabled: walletMnemonicSelected.length < 12,
                                onPress: this.handleImport,
                                title: strings('walletCreate.importButton')
                            }}
                            secondaryButton={{
                                type: 'settings',
                                onPress: this.openWalletSettings
                            }}
                        />
                    </View>
                </ScrollView>
            </ScreenWrapper>
        )
    }
}

EnterMnemonicPhrase.contextType = ThemeContext

const mapStateToProps = (state) => {
    return {
        walletCreateStore: state.createWalletStore
    }
}

export default connect(mapStateToProps, {})(EnterMnemonicPhrase)

const styles = StyleSheet.create({
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'space-between'
    },
    wordsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorMessage: {
        fontFamily: 'SFUIDisplay-Semibold',
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: 1,
        marginLeft: 12,
        flex: 1
    }
})
