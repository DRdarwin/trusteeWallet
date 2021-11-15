/**
 * @version 0.52
 */
import React from 'react'
import { connect } from 'react-redux'
import {
    FlatList,
    RefreshControl,
    Linking,
    View,
    ActivityIndicator,
    Text,
    TouchableOpacity
} from 'react-native'

import LottieView from 'lottie-react-native'

import { strings } from '@app/services/i18n'

import { showModal } from '@app/appstores/Stores/Modal/ModalActions'
import { setLoaderStatus, setSelectedAccount } from '@app/appstores/Stores/Main/MainStoreActions'

import accountHdDS from '@app/appstores/DataSource/Account/AccountHd'
import accountScanningDS from '@app/appstores/DataSource/Account/AccountScanning'

import { ThemeContext } from '@app/theme/ThemeProvider'
import ListItem from '@app/components/elements/new/list/ListItem/SubSetting'
import Input from '@app/components/elements/NewInput'

import Log from '@app/services/Log/Log'

import BlocksoftDict from '@crypto/common/BlocksoftDict'
import BlocksoftPrettyStrings from '@crypto/common/BlocksoftPrettyStrings'
import BlocksoftPrettyNumbers from '@crypto/common/BlocksoftPrettyNumbers'

import UpdateAccountBalanceAndTransactions from '@app/daemons/back/UpdateAccountBalanceAndTransactions'
import UpdateAccountListDaemon from '@app/daemons/view/UpdateAccountListDaemon'
import { BlocksoftTransfer } from '@crypto/actions/BlocksoftTransfer/BlocksoftTransfer'

import store from '@app/store'
import styles from '@app/modules/Account/AccountSettings/elements/styles'
import config from '@app/config/config'

import BlocksoftUtils from '@crypto/common/BlocksoftUtils'
import NavStore from '@app/components/navigation/NavStore'

import InputAndButtonsPartBalanceButton from '@app/modules/Send/elements/InputAndButtonsPartBalanceButton'
import Button from '@app/components/elements/new/buttons/Button'
import LetterSpacing from '@app/components/elements/LetterSpacing'
import StakingItem from './StakingItem'

import blackLoader from '@assets/jsons/animations/refreshBlack.json'
import whiteLoader from '@assets/jsons/animations/refreshWhite.json'

import { HIT_SLOP } from '@app/theme/HitSlop'
import CustomIcon from '@app/components/elements/CustomIcon'
import Tabs from '@app/components/elements/new/Tabs'
import SolStakeUtils from '@crypto/blockchains/sol/ext/SolStakeUtils'
import BlocksoftExternalSettings from '@crypto/common/BlocksoftExternalSettings'

import MainListItem from '@app/components/elements/new/list/ListItem/Setting'
import settingsActions from '@app/appstores/Stores/Settings/SettingsActions'
import { getSolValidator } from '@app/appstores/Stores/Main/selectors'
import RewardItem from '@app/modules/Account/AccountSettings/RewardItem'
import { SendActionsBlockchainWrapper } from '@app/appstores/Stores/Send/SendActionsBlockchainWrapper'


class SettingsSOL extends React.PureComponent {

    constructor(props) {
        super(props)
        this.state = {
            currentSOL: false,
            currentAddresses: false,
            currentAddressesLoaded: false,
            stakedAddresses: false,
            lastTransactions: [],
            refreshing: false,
            clickRefresh: false,
            load: true,
            partBalance: null,
            voteAddresses: [],
            rewards: [],
            transferAllBalance : false,
            selectedVoteAddress: {
                address: '',
                commission: false,
                activatedStake: false,
                name: false,
                description: '',
                website: ''
            },

            tabs: [
                {
                    title: strings('settings.walletList.stake'),
                    index: 0,
                    active: true
                },
                {
                    title: strings('settings.walletList.rewards'),
                    index: 1,
                    active: false
                },
                {
                    title: strings('settings.walletList.address'),
                    index: 2,
                    active: false
                }
            ]
        }
        this.stakeAmountInput = React.createRef()
    }

    componentDidMount() {
        this.init()
        this.handleScan()
    }

    init = async () => {
        const addresses = await accountScanningDS.getAddresses({
            currencyCode: 'SOL',
            walletHash: this.props.wallet.walletHash
        })
        const currentAddresses = []
        if (addresses) {
            for (const address in addresses) {
                currentAddresses.push({ address })
            }
        }
        this.setState({
            currentAddresses,
            currentAddressesLoaded: true,
        })
    }

    handleScan = async (force = false) => {
        const { account } = this.props
        const { address, balance } = account
        this.setState({
            stakedAddresses: [],
            voteAddresses: [],
            load: true
        }, async () => {

            const selectedVoteAddress = await settingsActions.getSetting('SOL_validator')
            const voteAddresses = await SolStakeUtils.getVoteAddresses()
            const stakedAddresses = await SolStakeUtils.getAccountStaked(address, force)
            const rewards = await SolStakeUtils.getAccountRewards(address)
            const newData = {
                stakedAddresses,
                voteAddresses,
                rewards,
                load: false
            }

            /*
            try {
                const transferAllBalance = await BlocksoftTransfer.getTransferAllBalance({amount : balance, currencyCode: 'SOL', addressFrom: address })
                newData.transferAllBalance = transferAllBalance
            } catch (e) {
                Log.err('SettingsSOL.handleScan getTransferAllBalance error ' + e.message)
                // nothing
            }
            */

            if (selectedVoteAddress) {
                newData.selectedVoteAddress = JSON.parse(selectedVoteAddress)
            } else if (voteAddresses && voteAddresses.length > 0) {
                newData.selectedVoteAddress = voteAddresses[0]
            } else {
                newData.selectedVoteAddress = {
                    address: BlocksoftExternalSettings.getStatic('SOL_VOTE_BEST'),
                    commission: false,
                    activatedStake: false,
                    name: false,
                    description: '',
                    website: ''
                }
            }

            this.setState(newData)
        })
    }

    handleRefresh = async (click = false) => {
        this.setState({
            refreshing: !click,
            clickRefresh: click
        })

        await this.handleScan(true)

        this.setState({
            refreshing: false,
            clickRefresh: false
        })
    }

    handleSetMain = async (newAddress, oldAddress) => {
        const { wallet, account } = this.props

        showModal({
            type: 'YES_NO_MODAL',
            icon: 'WARNING',
            title: strings('settings.walletList.setAddressesFromHD.title'),
            description: strings('settings.walletList.setAddressesFromHD.description', { newAddress })
        }, async () => {
            setLoaderStatus(true)

            try {
                await accountHdDS.setMainAddress({ newAddress, oldAddress: account.address, currencyCode: 'SOL', basicCurrencyCode: 'SOL', walletHash: wallet.walletHash })
            } catch (e) {
                Log.errDaemon('SettingsSOL.handleSetMain error setMainAddress ' + e.message)
            }

            try {
                const { accountList } = store.getState().accountStore
                if (typeof accountList[this.props.wallet.walletHash] !== 'undefined') {
                    for (const subCurrencyCode in accountList[this.props.wallet.walletHash]) {
                        const settings = BlocksoftDict.getCurrencyAllSettings(subCurrencyCode)
                        if (typeof settings.addressCurrencyCode !== 'undefined' && typeof settings.tokenBlockchain !== 'undefined' && settings.tokenBlockchain === 'SOLANA') {
                            try {
                                await accountHdDS.setMainAddress({ newAddress, oldAddress: account.address, currencyCode: subCurrencyCode, basicCurrencyCode: 'SOL', walletHash: wallet.walletHash })
                            } catch (e) {
                                Log.errDaemon('SettingsSOL.handleSetMain error setMainAddress subCurrency ' + subCurrencyCode + ' ' + e.message)
                            }
                        }
                    }
                }
            } catch (e) {
                Log.errDaemon('SettingsSOL.handleSetMain error setTokenAddresses ' + e.message)
            }

            try {
                await UpdateAccountBalanceAndTransactions.updateAccountBalanceAndTransactions({ force: true, currencyCode: account.currencyCode, source: 'ACCOUNT_SET_MAIN' })
            } catch (e) {
                Log.errDaemon('SettingsSOL.handleSetMain error updateAccountBalanceAndTransactions ' + e.message)
            }

            try {
                await UpdateAccountListDaemon.updateAccountListDaemon({ force: true, currencyCode: 'SOL', source: 'ACCOUNT_SET_MAIN' })
            } catch (e) {
                Log.errDaemon('SettingsSOL.handleSetMain error updateAccountListDaemon ' + e.message)
            }

            await setSelectedAccount()

            setLoaderStatus(false)
        })
    }

    handleStake = async () => {
        setLoaderStatus(true)

        const { account, solValidator } = this.props

        try {

            const inputValidate = await this.stakeAmountInput.handleValidate()
            if (inputValidate.status !== 'success') {
                throw new Error('invalid custom stake value')
            }
            const prettyStake = inputValidate.value
            const stake = BlocksoftPrettyNumbers.setCurrencyCode('SOL').makeUnPretty(prettyStake)

            let voteAddress = solValidator?.address ? solValidator.address : this.state.selectedVoteAddress.address
            console.log('voteAddress ' + voteAddress)
            if (!voteAddress) {
                voteAddress = await settingsActions.getSetting('SOL_validator')
            }
            if (!voteAddress) {
                voteAddress = BlocksoftExternalSettings.getStatic('SOL_VOTE_BEST')
            }


            const txData = {
                currencyCode: 'SOL',
                amount: stake,
                walletHash: account.walletHash,
                derivationPath: account.derivationPath,
                addressFrom: account.address,
                addressTo: 'STAKE',
                blockchainData: {
                    voteAddress
                }
            }
            const result = await BlocksoftTransfer.sendTx(txData, { uiErrorConfirmed: true })
            if (result) {
                showModal({
                    type: 'INFO_MODAL',
                    icon: true,
                    title: strings('modal.send.success'),
                    description: result.transactionHash
                })
                const lastTransactions = this.state.lastTransactions
                lastTransactions.push({ transactionHash: result.transactionHash, type: 'STAKE', amount: prettyStake })
                this.setState({ lastTransactions })
                this.stakeAmountInput.handleInput('', false)
            }
        } catch (e) {
            if (config.debug.cryptoErrors) {
                console.log('SettingsSol.handleStake error ', e)
            }
            const msg = e.message.indexOf('SERVER_RESPONSE_') === -1 ? e.message : strings('send.errors.' + e.message)
            showModal({
                type: 'INFO_MODAL',
                icon: null,
                title: strings('modal.exchange.sorry'),
                description: msg
            })
        }
        setLoaderStatus(false)
    }

    renderTabs = () => <Tabs tabs={this.state.tabs} changeTab={this.handleChangeTab} />

    handleChangeTab = (newTab) => {
        const newTabs = this.state.tabs.map(tab => ({
            ...tab,
            active: tab.index === newTab.index
        }))
        this.setState(() => ({ tabs: newTabs }))
    }

    handleStakeTransaction = (item) => {
        const { account } = this.props
        if (item.type) {
            Linking.openURL('https://explorer.solana.com/tx/' + item.transactionHash)
        } else {
            NavStore.goNext('StakingTransactionScreen', { stakingItem: item, stakingAccount: account })
        }
    }

    renderItemAddress = ({ item, index }) => {

        const { account } = this.props

        const address = item.address
        const addressPrep = BlocksoftPrettyStrings.makeCut(address, 10, 8)

        return <ListItem
            key={index}
            title={addressPrep}
            onPress={() => this.handleSetMain(address)}
            checked={account.address === address}
            last={this.state.currentAddresses.length - 1 === index}
        />
    }

    renderStakeItem = ({ item, index }) => {

        const { isLight } = this.context

        const { cryptoCurrency } = this.props

        const prettyStake = BlocksoftPrettyNumbers.setCurrencyCode('SOL').makePretty(item.amount || item.diff)

        const addressPrep = item.stakeAddress ? BlocksoftPrettyStrings.makeCut(item.stakeAddress, 10, 8) : false
        const hashPrep = item.transactionHash ? BlocksoftPrettyStrings.makeCut(item.transactionHash, 10, 8) : false

        return (
            <StakingItem
                key={index}
                address={hashPrep || addressPrep}
                amount={prettyStake}
                currencyCode='SOL'
                onPress={() => hashPrep
                    ? Linking.openURL('https://explorer.solana.com/tx/' + item.transactionHash)
                    : this.handleStakeTransaction(item)}
                color={isLight ? cryptoCurrency.mainColor : cryptoCurrency.darkColor}
                status={item.type ? strings('account.transactionStatuses.process') : item.status}
                inProcess={item.type}
            />
        )
    }

    renderRewards = ({ item, index }) => {
        const { account } = this.props
        const { address } = account

        const { isLight } = this.context

        const { cryptoCurrency } = this.props

        const prettyStake = BlocksoftPrettyNumbers.setCurrencyCode('SOL').makePretty(item.amount)

        return (
            <RewardItem
                key={index}
                epoch={item.epoch}
                apr={item.apr}
                timestamp={item.timestamp}
                amount={prettyStake}
                currencyCode='SOL'
                onPress={() => Linking.openURL('https://solanabeach.io/address/' + address + '/stake-rewards')}
                color={isLight ? cryptoCurrency.mainColor : cryptoCurrency.darkColor}
            />
        )
    }

    handlePartBalance = (newPartBalance) => {
        const { account } = this.props
        const { balance } = account

        let transferAllBalance = balance - 3 * BlocksoftExternalSettings.getStatic('SOL_PRICE')
        /*
        if (this.state.transferAllBalance && typeof this.state.transferAllBalance.fees !== 'undefined') {
            transferAllBalance = this.state.transferAllBalance.fees[this.state.transferAllBalance.selectedFeeIndex].amountForTx
        }
        */
        // if newPartBalance = 4 = 100%
        Log.log('SettingsSOL.Input.handlePartBalance ' + newPartBalance + ' clicked')
        this.setState({
            partBalance: newPartBalance
        }, async () => {
            let cryptoValue
            if (this.state.partBalance === 4) {
                cryptoValue = transferAllBalance
            } else {
                cryptoValue = BlocksoftUtils.mul(BlocksoftUtils.div(transferAllBalance, 4), this.state.partBalance)
            }
            const pretty = BlocksoftPrettyNumbers.setCurrencyCode('SOL').makePretty(cryptoValue)
            Log.log('SettingsSOL.Input.handlePartBalance ' + newPartBalance + ' end counting ' + cryptoValue + ' => ' + pretty)
            this.stakeAmountInput.handleInput(pretty)
        })
    }

    handleGoToSelect = () => {
        NavStore.goNext('SolValidators')
    }

    render() {
        const { currentAddresses, currentAddressesLoaded, lastTransactions, stakedAddresses, load, tabs, selectedVoteAddress, rewards } = this.state
        const { account, solValidator } = this.props
        const { colors, GRID_SIZE, isLight } = this.context

        const { balanceTotalPretty } = account

        const validator = solValidator && solValidator?.address ? solValidator : selectedVoteAddress

        return (
            <View style={{ flexGrow: 1 }}>
                {tabs[2].active &&
                <>
                    <View style={{ height: '100%' }}>
                        {currentAddressesLoaded &&
                        <FlatList
                            data={currentAddresses}
                            contentContainerStyle={{ paddingVertical: GRID_SIZE, marginHorizontal: GRID_SIZE }}
                            showsVerticalScrollIndicator={false}
                            keyExtractor={item => item.address.toString()}
                            ListHeaderComponent={() => (
                                <>
                                    <View style={{ paddingBottom: GRID_SIZE }}>
                                        {this.renderTabs()}
                                    </View>
                                    <LetterSpacing
                                        text={strings('settings.walletList.selectAddress').toUpperCase()}
                                        textStyle={[styles.settings__title, { paddingBottom: GRID_SIZE, color: colors.sendScreen.amount }]}
                                        letterSpacing={1.5}
                                    />
                                </>
                            )}
                            renderItem={this.renderItemAddress}
                        />
                        }
                    </View>
                </>
                }

                {tabs[1].active &&
                <>
                    <FlatList
                        data={rewards}
                        contentContainerStyle={{ paddingVertical: GRID_SIZE, paddingHorizontal: GRID_SIZE }}
                        keyExtractor={item => item.epoch.toString()}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps='handled'
                        refreshControl={
                            <RefreshControl
                                refreshing={this.state.refreshing}
                                onRefresh={this.handleRefresh}
                                tintColor={colors.common.text1}
                            />
                        }
                        ListEmptyComponent={() => {
                            if (load) {
                                return (
                                    <ActivityIndicator
                                        size='large'
                                        style={{
                                            backgroundColor: 'transparent',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            paddingTop: GRID_SIZE
                                        }}
                                        color={this.context.colors.common.text2}
                                    />
                                )
                            } else {
                                return null
                            }
                        }}
                        ListHeaderComponent={() => (
                            <>
                                <View style={{ paddingBottom: GRID_SIZE }}>
                                    {this.renderTabs()}
                                </View>

                                <View style={{ flexDirection: 'row', position: 'relative', justifyContent: 'space-between', alignItems: 'center', paddingBottom: GRID_SIZE / 2, paddingTop: GRID_SIZE }}>
                                    <View style={{ flexDirection: 'column' }}>
                                        <Text style={[styles.transaction_title, { color: colors.common.text1, paddingLeft: GRID_SIZE }]}>{strings('settings.walletList.rewards')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ alignItems: 'center', marginRight: GRID_SIZE }}
                                        onPress={() => this.handleRefresh(true)}
                                        hitSlop={HIT_SLOP}
                                    >
                                        {this.state.clickRefresh ?
                                            <LottieView
                                                style={{ width: 20, height: 20 }}
                                                source={isLight ? blackLoader : whiteLoader}
                                                autoPlay
                                                loop
                                            /> :
                                            <CustomIcon name='reloadTx' size={20} color={colors.common.text1} />}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                        renderItem={this.renderRewards}
                    />
                </>
                }

                {tabs[0].active &&
                <>
                    <FlatList
                        data={stakedAddresses ? [...lastTransactions, ...stakedAddresses] : lastTransactions}
                        contentContainerStyle={{ paddingVertical: GRID_SIZE, paddingHorizontal: GRID_SIZE }}
                        keyExtractor={item => item?.transactionHash ? item.transactionHash.toString() : item.stakeAddress.toString()}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps='handled'
                        refreshControl={
                            <RefreshControl
                                refreshing={this.state.refreshing}
                                onRefresh={this.handleRefresh}
                                tintColor={colors.common.text1}
                            />
                        }
                        ListEmptyComponent={() => {
                            if (load) {
                                return (
                                    <ActivityIndicator
                                        size='large'
                                        style={{
                                            backgroundColor: 'transparent',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            paddingTop: GRID_SIZE
                                        }}
                                        color={this.context.colors.common.text2}
                                    />
                                )
                            } else {
                                return null
                            }
                        }}
                        ListHeaderComponent={() => (
                            <>
                                <View style={{ paddingBottom: GRID_SIZE }}>
                                    {this.renderTabs()}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <Input
                                        ref={ref => this.stakeAmountInput = ref}
                                        id='stakeAmount'
                                        name={strings('settings.walletList.enterToStakeSOL')}
                                        keyboardType='numeric'
                                        inputBaseColor='#f4f4f4'
                                        inputTextColor='#f4f4f4'
                                        tintColor='#7127ac'
                                        paste={true}
                                    />
                                </View>

                                {balanceTotalPretty > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: GRID_SIZE * 1.5 }}>
                                        <InputAndButtonsPartBalanceButton
                                            action={() => this.handlePartBalance(1)}
                                            text='25%'
                                            inverse={this.state.partBalance === 1}
                                        />
                                        <InputAndButtonsPartBalanceButton
                                            action={() => this.handlePartBalance(2)}
                                            text='50%'
                                            inverse={this.state.partBalance === 2}
                                        />
                                        <InputAndButtonsPartBalanceButton
                                            action={() => this.handlePartBalance(3)}
                                            text='75%'
                                            inverse={this.state.partBalance === 3}
                                        />
                                        <InputAndButtonsPartBalanceButton
                                            action={() => this.handlePartBalance(4)}
                                            text='100%'
                                            inverse={this.state.partBalance === 4}
                                        />
                                    </View>
                                )}
                                <View style={{ paddingVertical: GRID_SIZE }}>
                                    <MainListItem
                                        title={strings('settings.walletList.validatorSOL')}
                                        subtitle={validator.name ? validator.name : BlocksoftPrettyStrings.makeCut(validator.address, 8, 8)}
                                        onPress={this.handleGoToSelect}
                                        iconType='scanning'
                                        rightContent='arrow'
                                        last
                                    />
                                </View>

                                <View style={{ paddingVertical: GRID_SIZE }}>
                                    <Button
                                        title={strings('settings.walletList.stakeSOL').toUpperCase()}
                                        onPress={() => this.handleStake(false)}
                                    />
                                </View>

                                <View style={{ flexDirection: 'row', position: 'relative', justifyContent: 'space-between', alignItems: 'center', paddingBottom: GRID_SIZE / 2, paddingTop: GRID_SIZE }}>
                                    <View style={{ flexDirection: 'column' }}>
                                        <Text style={[styles.transaction_title, { color: colors.common.text1, paddingLeft: GRID_SIZE }]}>{strings('settings.walletList.stakeHistorySOL')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ alignItems: 'center', marginRight: GRID_SIZE }}
                                        onPress={() => this.handleRefresh(true)}
                                        hitSlop={HIT_SLOP}
                                    >
                                        {this.state.clickRefresh ?
                                            <LottieView
                                                style={{ width: 20, height: 20 }}
                                                source={isLight ? blackLoader : whiteLoader}
                                                autoPlay
                                                loop
                                            /> :
                                            <CustomIcon name='reloadTx' size={20} color={colors.common.text1} />}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                        renderItem={this.renderStakeItem}
                    />
                </>
                }
            </View>
        )
    }
}


SettingsSOL.contextType = ThemeContext

const mapStateToProps = state => {
    return {
        solValidator: getSolValidator(state)
    }
}

export default connect(mapStateToProps, null, null, { forwardRef: true })(SettingsSOL)
